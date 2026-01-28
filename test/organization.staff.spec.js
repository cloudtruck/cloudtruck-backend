import request from 'supertest';
import { expect } from 'chai';
import { startTestDB, stopTestDB, app } from './setup.js';
import User from '../src/models/user.model.js';
import Staff from '../src/models/staff.model.js';
import OrganizationSettings from '../src/models/organizationSettings.model.js';
import mongoose from 'mongoose';

describe('Organization & Staff Improvements', () => {
    let superAdminToken;
    let staffToken;
    let superAdminUser;
    let staffUser;
    let staffProfile;

    before(async () => {
        await startTestDB();

        // Clean up
        await User.deleteMany({});
        await Staff.deleteMany({});
        await OrganizationSettings.deleteMany({});

        // Create Super Admin
        superAdminUser = await User.create({
            email: 'admin@cloudtruck.com',
            phone: '9876543210',
            password: 'Password123!',
            role: 'super-admin',
            status: 'active'
        });
        superAdminToken = superAdminUser.generateAccessToken();

        // Create Staff User
        staffUser = await User.create({
            email: 'staff@cloudtruck.com',
            phone: '9876543211',
            password: 'Password123!',
            role: 'staff',
            status: 'active'
        });
        staffToken = staffUser.generateAccessToken();

        // Create Staff Profile
        staffProfile = await Staff.create({
            user: staffUser._id,
            name: 'John Staff',
            department: 'operations',
            title: 'Operations Manager',
            isActive: true,
            createdBy: superAdminUser._id
        });
    });

    after(async () => {
        await stopTestDB();
    });

    describe('Organization Settings API', () => {
        it('should fetch organization settings as super-admin', async () => {
            const res = await request(app)
                .get('/api/v1/organization/settings')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).to.equal(200);
            expect(res.body.success).to.be.true;
            expect(res.body.data.companyName).to.equal('CloudTruck Logistics');
        });

        it('should update organization settings as super-admin', async () => {
            const updateData = {
                companyName: 'CloudTruck Global',
                taxSettings: {
                    gstEnabled: true,
                    cgstRate: 10,
                    sgstRate: 10
                }
            };

            const res = await request(app)
                .patch('/api/v1/organization/settings')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send(updateData);

            expect(res.status).to.equal(200);
            expect(res.body.data.companyName).to.equal('CloudTruck Global');
            expect(res.body.data.taxSettings.cgstRate).to.equal(10);
        });

        it('should fail to update settings as regular staff without permission', async () => {
            const res = await request(app)
                .patch('/api/v1/organization/settings')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({ companyName: 'Hacked name' });

            expect(res.status).to.equal(403);
        });

        it('should generate next booking number', async () => {
            const res = await request(app)
                .get('/api/v1/organization/settings/next-booking-number')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).to.equal(200);
            expect(res.body.data.bookingNumber).to.match(/^BK\d{6}$/);
        });
    });

    describe('Staff Reporting Manager', () => {
        it('should create a new staff with a reporting manager', async () => {
            const staffUserData = {
                email: 'junior@cloudtruck.com',
                phone: '9876543212',
                password: 'Password123!',
                role: 'staff'
            };

            const newUser = await User.create(staffUserData);
            
            const staffPayload = {
                userId: newUser._id.toString(),
                name: 'Junior Staff',
                department: 'operations',
                reportingManager: staffProfile._id.toString()
            };

            const res = await request(app)
                .post('/api/v1/staff')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send(staffPayload);

            expect(res.status).to.equal(201);
            expect(res.body.data.reportingManager.toString()).to.equal(staffProfile._id.toString());
        });

        it('should filter staff by reporting manager', async () => {
            // First ensure the junior staff exists (from previous test)
            const res = await request(app)
                .get(`/api/v1/staff?reportingManager=${staffProfile._id}`)
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).to.equal(200);
            expect(res.body.data.staff).to.be.an('array');
            expect(res.body.data.staff.length).to.be.at.least(1);
        });

        it('should fail to set non-existent reporting manager during update', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const staffPayload = {
                reportingManager: fakeId.toString()
            };

            const res = await request(app)
                .patch(`/api/v1/staff/${staffProfile._id}`)
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send(staffPayload);

            expect(res.status).to.equal(404);
            expect(res.body.message).to.equal('Reporting manager not found');
        });

        it('should fail to set self as reporting manager', async () => {
            const staffPayload = {
                reportingManager: staffProfile._id.toString()
            };

            const res = await request(app)
                .patch(`/api/v1/staff/${staffProfile._id}`)
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send(staffPayload);

            expect(res.status).to.equal(400);
            expect(res.body.message).to.equal('Staff member cannot report to themselves');
        });
    });
});
