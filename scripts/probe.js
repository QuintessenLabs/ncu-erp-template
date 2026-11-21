// Developer helper: logs in and reports what every known endpoint returns.
// Use it to explore the portal or to check whether a field is still where we expect it.
//
// PowerShell:
//   $env:NCU_USERNAME = 'your-username'
//   $env:NCU_PASSWORD = 'your-password'
//   node scripts/probe.js          # summary only (row counts)
//   node scripts/probe.js --raw    # full unnormalised JSON (contains personal data!)
//
// Do not commit or share the --raw output. It contains your personal records.

import { PortalClient } from '../src/portal/client.js';
import { PATHS } from '../src/portal/endpoints.js';

const username = process.env.NCU_USERNAME;
const password = process.env.NCU_PASSWORD;
if (!username || !password) {
  console.error('Set NCU_USERNAME and NCU_PASSWORD environment variables first.');
  process.exit(1);
}

const showRaw = process.argv.includes('--raw');
const client = new PortalClient();

try {
  const user = await client.login(username, password);
  console.log(`Logged in as user id ${user.id}.`);
} catch (err) {
  console.error(`Login failed: ${err.message}`);
  process.exit(1);
}

for (const key of Object.keys(PATHS)) {
  if (key === 'login') continue;
  const query = {};
  if (key === 'attendanceDetails') {
    if (!process.env.NCU_COURSE_CODE) {
      console.log(`${key}: skipped (set NCU_COURSE_CODE to probe it)`);
      continue;
    }
    query.code = process.env.NCU_COURSE_CODE;
  }
  try {
    const data = await client.raw(key, query);
    const size = Array.isArray(data) ? `${data.length} rows` : `object with keys: ${Object.keys(data ?? {}).join(', ')}`;
    console.log(`${key}: ok, ${size}`);
    if (showRaw) console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.log(`${key}: ERROR, ${err.message}`);
  }
}

// Biometric punches: only reachable on the campus network. Shows the last 7 days for your roll number.
try {
  const { rollNo } = await client.getBasicDetails();
  const { BiometricClient } = await import('../src/biometric/client.js');
  const { todayInZone, addDays } = await import('../src/biometric/dates.js');
  const { config } = await import('../src/config.js');
  const to = todayInZone(config.timeZone);
  const from = addDays(to, -6);
  const punches = await new BiometricClient().getPunches({ rollNo, from, to });
  console.log(`biometric (${from} to ${to}): ok, ${punches.length} punches`);
  if (showRaw) console.log(JSON.stringify(punches, null, 2));
} catch (err) {
  console.log(`biometric: ERROR, ${err.message}`);
}
