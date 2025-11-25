import dotenv from 'dotenv';
import FritzBoxApi from 'fritzbox-api';

dotenv.config();

const {
  FRITZ_USER,
  FRITZ_PASS,
  FRITZ_URL,
  DOMAIN_EXTERNAL,
  NAMECOM_USER,
  NAMECOM_TOKEN,
} = process.env;

const fritzBoxApi = new FritzBoxApi({ url: FRITZ_URL });
let routerIp = '';

async function execute() {
  if (await fritzBoxApi.login(FRITZ_USER, FRITZ_PASS)) {
    const sessionId = await fritzBoxApi.getSessionId();
    const url = `${FRITZ_URL}/api/v0/connections`;

    const fritz = await fetch(url, { headers: { 'AUTHORIZATION': `AVM-SID ${sessionId}` } });
    const fritzJson = await fritz.json();

    // skip if ip is unchanged
    if (fritzJson.connection[0].ip4_masqaddr === routerIp) {
      return;
    }

    routerIp = fritzJson.connection[0].ip4_masqaddr;

    const nameAuth = {
      Authorization: `Basic ${Buffer.from(NAMECOM_USER + ":" + NAMECOM_TOKEN).toString('base64')}`
    };

    const namecom = await fetch(`https://api.name.com/core/v1/domains/${DOMAIN_EXTERNAL}/records`, {
      headers: nameAuth,
    });
    const namecomJson = await namecom.json();
    const results = await Promise.all(namecomJson.records.map((record: { answer: string; id: string; type: string; }) => {
      if (routerIp !== record.answer) {
        return fetch(`https://api.name.com/core/v1/domains/${DOMAIN_EXTERNAL}/records/${record.id}`, {
          method: 'PUT',
          headers: {
            ...nameAuth,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...record,
            answer: routerIp,
          }),
        });
      }

      return Promise.resolve(true);
    }));

    namecomJson.records.forEach((record: { answer: string; id: string; type: string; }, index: number) => {
      const result = results[index];
      if (typeof result === 'boolean') {
        console.info('Skipped', record);
      } else {
        console.info('Updated', record);
      }
    });
  } else {
    console.error('Could not login to FritzBox');
  }
}

execute().then();
setInterval(execute, 60 * 1000);
