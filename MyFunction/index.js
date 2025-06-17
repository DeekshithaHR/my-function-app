const axios = require('axios');

const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const siteId = process.env.SITE_ID;
const driveId = process.env.DRIVE_ID;
const openaiKey = process.env.OPENAI_KEY;
const openaiEndpoint = process.env.OPENAI_ENDPOINT;
const deploymentName = process.env.OPENAI_DEPLOYMENT_NAME;

module.exports = async function (context, req) {
  const { folderId, question } = req.body;

  try {
    const tokenResponse = await axios.post(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      })
    );
    const accessToken = tokenResponse.data.access_token;

    const filesResp = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${folderId}/children`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let fullText = '';
    for (const file of filesResp.data.value) {
      if (file.file) {
        const content = await axios.get(
          `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${file.id}/content`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        fullText += `\n\n[${file.name}]:\n${content.data}`;
      }
    }

    const gptResp = await axios.post(
      `${openaiEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2023-05-15`,
      {
        messages: [
          { role: 'system', content: 'Answer the question using only the provided documents.' },
          { role: 'user', content: `Documents:\n${fullText}\n\nQuestion: ${question}` }
        ],
        temperature: 0.3,
        max_tokens: 500
      },
      { headers: { 'api-key': openaiKey, 'Content-Type': 'application/json' } }
    );

    const answer = gptResp.data.choices[0].message.content;
    context.res = { status: 200, body: { answer } };

  } catch (err) {
    context.log.error(err.message);
    context.res = { status: 500, body: { error: err.message } };
  }
};