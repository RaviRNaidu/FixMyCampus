import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import assert from 'node:assert/strict';
import User from '../src/models/User.js';
import app from '../src/app.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });
assert.ok(process.env.MONGODB_URI, 'Set MONGODB_URI in server/.env before running this test.');
assert.ok(process.env.JWT_SECRET, 'Set JWT_SECRET in server/.env before running this test.');

// Use a fresh, uniquely named database. The configured application database is never modified.
const testDb = `fmc_sec_${Date.now()}`;
const testUri = new URL(process.env.MONGODB_URI);
testUri.pathname = `/${testDb}`;
let server;
let connected = false;

const credentials = {
  student: { name: 'Test Student', email: `student-${Date.now()}@example.test`, password: 'Student-Test-Password-1' },
  admin: { name: 'Test Admin', email: `admin-${Date.now()}@example.test`, password: 'Admin-Test-Password-1' },
  staff: { name: 'Test Staff', email: `staff-${Date.now()}@example.test`, password: 'Staff-Test-Password-1' },
  secondStudent: { name: 'Other Student', email: `other-${Date.now()}@example.test`, password: 'Other-Test-Password-1' },
};

async function call(base, path, { method = 'GET', cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}/api/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await response.json();
  const cookieHeader = response.headers.get('set-cookie');
  return { response, json, cookie: cookieHeader?.split(';')[0] };
}

async function login(base, account) {
  const result = await call(base, '/auth/login', { method: 'POST', body: { email: account.email, password: account.password } });
  assert.equal(result.response.status, 200, `Login failed for ${account.email}`);
  assert.ok(result.cookie, 'Login must set an HttpOnly session cookie.');
  return result.cookie;
}

try {
  await mongoose.connect(testUri.toString(), { serverSelectionTimeoutMS: 15000 });
  connected = true;
  await new Promise(resolve => { server = app.listen(0, resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;

  const registration = await call(base, '/auth/register', { method: 'POST', body: { ...credentials.student, role: 'admin' } });
  assert.equal(registration.response.status, 201);
  assert.equal(registration.json.data.user.role, 'student', 'Public signup must ignore submitted roles.');
  const studentCookie = registration.cookie;
  assert.ok(studentCookie, 'Registration must set a session cookie.');
  const unauthenticatedStaffCreate = await call(base, '/users/staff', { method: 'POST', body: credentials.staff });
  assert.equal(unauthenticatedStaffCreate.response.status, 401, 'Unauthenticated callers cannot create staff accounts.');
  const selfRoleChange = await call(base, '/auth/me', { method: 'PATCH', cookie: studentCookie, body: { role: 'admin' } });
  assert.equal(selfRoleChange.response.status, 404, 'There is no profile endpoint that accepts role changes.');
  const confirmedStudent = await call(base, '/auth/me', { cookie: studentCookie });
  assert.equal(confirmedStudent.json.data.user.role, 'student', 'An authenticated user cannot change their own role.');
  const duplicate = await call(base, '/auth/register', { method: 'POST', body: credentials.student });
  assert.equal(duplicate.response.status, 409, 'Duplicate email must be rejected.');
  assert.ok(await login(base, credentials.student), 'Student login should create a valid session.');

  const studentCreateStaff = await call(base, '/users/staff', { method: 'POST', cookie: studentCookie, body: credentials.staff });
  assert.equal(studentCreateStaff.response.status, 403, 'Students cannot create staff accounts.');
  const studentStaffList = await call(base, '/users/staff', { cookie: studentCookie });
  assert.equal(studentStaffList.response.status, 403, 'Students cannot access staff management.');

  const issueInput = { title: 'Projector not working', description: 'The projector in Room 204 does not turn on.', category: 'Classroom Equipment', building: 'Building A', room: '204', priority: 'high' };
  const createdIssue = await call(base, '/issues', { method: 'POST', cookie: studentCookie, body: issueInput });
  assert.equal(createdIssue.response.status, 201, 'Student issue reporting still works.');
  const issueId = createdIssue.json.data.issue._id;

  const admin = await User.create({ ...credentials.admin, email: credentials.admin.email, passwordHash: await bcrypt.hash(credentials.admin.password, 12), role: 'admin' });
  assert.equal(admin.role, 'admin');
  const adminCookie = await login(base, credentials.admin);
  const badRoleCreate = await call(base, '/users/staff', { method: 'POST', cookie: adminCookie, body: { ...credentials.staff, role: 'admin' } });
  assert.equal(badRoleCreate.response.status, 400, 'Staff creation rejects client supplied role fields.');

  const staffCreate = await call(base, '/users/staff', { method: 'POST', cookie: adminCookie, body: credentials.staff });
  assert.equal(staffCreate.response.status, 201, 'Admin can create a staff account.');
  assert.equal(staffCreate.json.data.user.role, 'staff', 'The server assigns the staff role.');
  assert.equal(staffCreate.json.data.user.passwordHash, undefined, 'Password hashes are never returned.');
  const staffRecord = await User.findById(staffCreate.json.data.user.id).select('+passwordHash');
  assert.ok(await bcrypt.compare(credentials.staff.password, staffRecord.passwordHash), 'Staff password is stored as a bcrypt hash.');
  const staffDuplicate = await call(base, '/users/staff', { method: 'POST', cookie: adminCookie, body: credentials.staff });
  assert.equal(staffDuplicate.response.status, 409, 'Duplicate staff email must be rejected.');

  const staffCookie = await login(base, credentials.staff);
  const staffCreateStaff = await call(base, '/users/staff', { method: 'POST', cookie: staffCookie, body: { ...credentials.secondStudent, email: credentials.secondStudent.email } });
  assert.equal(staffCreateStaff.response.status, 403, 'Staff cannot create staff accounts.');
  const staffAssign = await call(base, `/issues/${issueId}/assign`, { method: 'PATCH', cookie: staffCookie, body: { staffId: staffRecord._id.toString() } });
  assert.equal(staffAssign.response.status, 403, 'Staff cannot access admin assignment actions.');
  const staffCreateIssue = await call(base, '/issues', { method: 'POST', cookie: staffCookie, body: issueInput });
  assert.equal(staffCreateIssue.response.status, 403, 'Staff cannot use student issue creation.');

  const studentAssign = await call(base, `/issues/${issueId}/assign`, { method: 'PATCH', cookie: studentCookie, body: { staffId: staffRecord._id.toString() } });
  assert.equal(studentAssign.response.status, 403, 'Students cannot assign reports.');
  const adminAssign = await call(base, `/issues/${issueId}/assign`, { method: 'PATCH', cookie: adminCookie, body: { staffId: staffRecord._id.toString() } });
  assert.equal(adminAssign.response.status, 200, 'Admin assignment still works.');

  const secondRegistration = await call(base, '/auth/register', { method: 'POST', body: credentials.secondStudent });
  assert.equal(secondRegistration.response.status, 201);
  const otherStudentIssue = await call(base, '/issues', { method: 'POST', cookie: secondRegistration.cookie, body: issueInput });
  assert.equal(otherStudentIssue.response.status, 201);
  const hiddenFromStaff = await call(base, `/issues/${otherStudentIssue.json.data.issue._id}`, { cookie: staffCookie });
  assert.equal(hiddenFromStaff.response.status, 404, 'Staff cannot view an issue assigned to another account.');
  const unassignedUpdate = await call(base, `/issues/${otherStudentIssue.json.data.issue._id}/status`, { method: 'PATCH', cookie: staffCookie, body: { status: 'in_progress' } });
  assert.equal(unassignedUpdate.response.status, 403, 'Staff cannot update unassigned issues.');

  const startWork = await call(base, `/issues/${issueId}/status`, { method: 'PATCH', cookie: staffCookie, body: { status: 'in_progress', note: 'Checking the projector.' } });
  assert.equal(startWork.response.status, 200, 'Assigned staff can start work.');
  const resolve = await call(base, `/issues/${issueId}/status`, { method: 'PATCH', cookie: staffCookie, body: { status: 'resolved', note: 'Replaced the cable.' } });
  assert.equal(resolve.response.status, 200, 'Assigned staff can resolve the issue.');
  const invalidTransition = await call(base, `/issues/${issueId}/status`, { method: 'PATCH', cookie: staffCookie, body: { status: 'in_progress' } });
  assert.equal(invalidTransition.response.status, 409, 'Invalid status transitions remain blocked.');
  const studentDetail = await call(base, `/issues/${issueId}`, { cookie: studentCookie });
  assert.equal(studentDetail.response.status, 200, 'Reporter can see the issue timeline.');
  assert.equal(studentDetail.json.data.issue.timeline.length, 4, 'Initial, assignment, work and resolution events are retained.');
  const studentReadsOtherIssue = await call(base, `/issues/${otherStudentIssue.json.data.issue._id}`, { cookie: studentCookie });
  assert.equal(studentReadsOtherIssue.response.status, 404, 'Students cannot read another student’s issue.');

  console.log('Security integration checks passed: signup, login, role restrictions, staff creation, duplicates, ownership, assignment, transitions, and timeline.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (connected) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}
