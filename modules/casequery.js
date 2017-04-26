"use strict";

let auth = require("./slack-salesforce-auth"),
    force = require("./force"),

    CASEQUERY_TOKEN = process.env.SLACK_CASEQUERY_TOKEN;

exports.execute = (req, res) => {

    if (req.body.token != CASEQUERY_TOKEN) {
        res.send("Invalid token");
        return;
    }

    let slackUserId = req.body.user_id,
        oauthObj = auth.getOAuthObject(slackUserId),
        q = "SELECT Id, casenumber, Actual_Account__c, ownerid FROM case WHERE casenumber LIKE '%" + req.body.text + "%' LIMIT 5";

    force.query(oauthObj, q)
        .then(data => {
            let cases = JSON.parse(data).records;
            if (cases && cases.length > 0) {
                let attachments = [];
                cases.forEach(function (_case) {
                    let fields = [];
                    fields.push({title: "Caseid", value: _case.id, short: true});
                   
                    fields.push({title: "Open in Salesforce:", value: oauthObj.instance_url + "/" + _case.Id, short:false});
                    attachments.push({
                        color: "#FCB95B",
                        fields: fields
                    });
                });
                res.json({text: "Cases matching '" + req.body.text + "':", attachments: attachments});
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
