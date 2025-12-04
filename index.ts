import dotenv from 'dotenv';

dotenv.config();

const {
  DOMAIN_EXTERNAL,
  NAMECOM_USER,
  NAMECOM_TOKEN,
} = process.env;

async function execute() {
  const { ip } = await fetch('https://api.ipify.org?format=json').then((result) => result.json());

  const nameAuth = {
    Authorization: `Basic ${Buffer.from(NAMECOM_USER + ":" + NAMECOM_TOKEN).toString('base64')}`
  };

  const namecom = await fetch(`https://api.name.com/core/v1/domains/${DOMAIN_EXTERNAL}/records`, {
    headers: nameAuth,
  });
  const namecomJson = await namecom.json();

  if (!namecomJson.records) {
    throw new Error('Name.com auth failed');
  }

  const results = await Promise.all(namecomJson.records.map((record: { answer: string; id: string; type: string; }) => {
    if (ip !== record.answer) {
      return fetch(`https://api.name.com/core/v1/domains/${DOMAIN_EXTERNAL}/records/${record.id}`, {
        method: 'PUT',
        headers: {
          ...nameAuth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...record,
          answer: ip,
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
}

execute().then();
setInterval(execute, 60 * 1000);
