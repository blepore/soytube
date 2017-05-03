"use strict";

let auth = require("./slack-salesforce-auth"),
    force = require("./force"),

    CASEUPDATE_TOKEN = process.env.SLACK_CASEUPDATE_TOKEN;

exports.execute = (req, res) => {

    if (req.body.token != CASEUPDATE_TOKEN) {
        res.send("Invalid token");
        return;
    }

    let slackUserId = req.body.user_id,
        oauthObj = auth.getOAuthObject(slackUserId),
        params = req.body.text.split(":"),
        casenumber = params[0],
        newstatus = params[1],
        q = "SELECT Id, CaseNumber, Actual_Account__c, Contact.FirstName, Contact.LastName, Owner.Alias, OwnerId, Subject, Priority, Status FROM Case WHERE CaseNumber LIKE '%" + casenumber + "%' LIMIT 5";
    
    force.query(oauthObj, q)
        .then(data => {
            let cases = JSON.parse(data).records;
            if (cases && cases.length > 0) {
                let attachments = [];
                cases.forEach(function (_case) {
                    let fields = [];
                    //update each case with new status
                    force.update(oauthObj, "Case",
                        {
                            Id : _case.Id,
                            Status : newstatus,
                            OwnerId : _case.OwnerId
                        },
                        function(err, ret) {
                            if (err || !ret.success) { return console.error(err, ret); }
                            console.log('Updated Successfully : ' + ret.id);
                        }
                    );
                    fields.push({title: "Case Number", value: _case.CaseNumber, short: true});
                    fields.push({title: "Owner", value: _case.Owner.Alias, short: true});
                    fields.push({title: "Account", value: _case.Actual_Account__c, short: true});
                    fields.push({title: "Contact", value: _case.Contact.LastName + ', ' + _case.Contact.FirstName, short: true});
                    fields.push({title: "Status", value: newstatus, short: true});
                    fields.push({title: "Priority", value: _case.Priority, short: true});
                    fields.push({title: "Subject", value: _case.Subject, short: false});
                    fields.push({title: "Updater", value: slackUserId, short: false});
                    fields.push({title: "Open in Salesforce:", value: oauthObj.instance_url + "/" + _case.Id, short:false});
                    attachments.push({
                        color: "#FCB95B",
                        fields: fields
                    });
                });
                res.json({text: "Found a match for '" + casenumber + "' updating Status to '" + newstatus + "'", attachments: attachments});
            } else {
                res.send("No records");
            }
        })
    
        .catch(error => {
            if (error.code == 401) {
                res.send(`Visit this URL to login to Salesforce: https://${req.hostname}/login/` + slackUserId);
            } else {
                console.log(error);
                res.send("An error as occurred");
            }
        });
};
