import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT,
  // no keyFilename — uses ADC on the VM
});

const DATASET = 'liverpool_analytics';

export async function query(sql, params = []) {
  const [rows] = await bq.query({ query: sql, params, location: 'EU' });
  return rows;
}

export { DATASET };
