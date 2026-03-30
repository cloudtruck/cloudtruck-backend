# Changelog

> Format: `YYYY-MM-DD | <repo> | <file(s)> | <summary>`

2026-03-28 | cloudtruck-backend | src/models/organizationSettings.model.js | Add addressSubSchema subdocument and addresses array field to OrganizationSettings
2026-03-28 | cloudtruck-backend | src/models/branch.model.js | Add trafficCoordinator field (ObjectId ref Staff) to Branch schema
2026-03-28 | cloudtruck-backend | src/controllers/organization.controller.js | Add getAddresses, addAddress, updateAddress, deleteAddress, setPrimaryAddress controller methods
2026-03-28 | cloudtruck-backend | src/routes/organization.routes.js | Add address CRUD routes under /organization/addresses

2026-03-20 | cloudtruck-backend | src/services/auth.service.js | Remove supplier OTP block: allow role='supplier' to login via OTP (accounts are admin-created, phone exists in DB)
2026-03-20 | cloudtruck-backend | src/routes/document.routes.js | Add 'supplier' to checkRole on POD/LR/loading-images routes so suppliers can upload trip documents
2026-03-20 | cloudtruck-backend | src/controllers/supplierPayment.controller.js, src/routes/supplierPayment.routes.js | Supplier self-service payments: auto-resolve supplierId from JWT when role=supplier; open GET / to isStaffOrSupplier middleware
2026-03-20 | cloudtruck-backend | src/services/document.service.js | Add supplier ownership guard in uploadLR and uploadPOD: supplier can only upload docs for bookings assigned to their company
2026-03-20 | cloudTruckTrucker | src/hooks/usePersona.js | Add usePersona hook: single source of truth for isIndividualDriver/isEmployee/isSupplier + capability flags (canFindLoad, canUseWallet, hasFleetAccess, tripsEndpoint, profileEndpoint)
2026-03-20 | cloudTruckTrucker | src/redux/reducer/user.js | Add personaReady flag + setPersonaReady action to signal persona fetch is complete
2026-03-20 | cloudTruckTrucker | src/screens/Auth/RoleSelectScreen.js | New screen: role selector card UI (Driver / Fleet Owner) shown before Login
2026-03-20 | cloudTruckTrucker | src/screens/Auth/Login.js | Accept selectedRole param from RoleSelectScreen; send role in OTP verify; persona-aware post-login routing (supplier→onboarding/Tab, employee→Tab, driver→KYC flow)
2026-03-20 | cloudTruckTrucker | src/screens/Auth/SupplierOnboardingScreen.js | New screen: supplier onboarding form (company name + GSTIN), PATCH /suppliers/my-profile, dispatches setPersonaReady on success
2026-03-20 | cloudTruckTrucker | src/screens/Splash/SplashScreen.js | resumeSession: persona-aware session resume — fetch supplier or driver profile based on cached role, dispatch setPersonaReady, route accordingly
2026-03-20 | cloudTruckTrucker | src/config/urls.js | Add 6 supplier API URLs: MY_SUPPLIER_PROFILE, MY_SUPPLIER_BOOKINGS, MY_SUPPLIER_DASHBOARD, MY_FLEET_DRIVERS, MY_FLEET_VEHICLES, MY_SUPPLIER_PAYMENTS
2026-03-20 | cloudTruckTrucker | src/screens/Home/HomeDashBoard.js | Persona-conditional dashboard: hide wallet/findLoad for employees, show fleet overview for suppliers, show employee affiliation card, filter service cards by persona
2026-03-20 | cloudTruckTrucker | src/screens/Trips/Trips.js | Use MY_SUPPLIER_BOOKINGS endpoint for suppliers; normalize response items vs trips; add driverName/vehicleNumber to trip map
2026-03-20 | cloudTruckTrucker | src/screens/UploadLR/UploadLR.js | Persona-conditional fetch: suppliers use MY_SUPPLIER_BOOKINGS, drivers use DRIVER_BOOKINGS; normalize response shape
2026-03-20 | cloudTruckTrucker | src/screens/Trips/PODTripDetail.js | Persona-conditional fetch: same as UploadLR — suppliers get fleet-wide bookings
2026-03-20 | cloudTruckTrucker | src/screens/Supplier/SupplierProfileScreen.js | New screen: supplier company profile (name/status/GSTIN, fleet stats, bank details masked, performance stats)
2026-03-20 | cloudTruckTrucker | src/screens/Supplier/SupplierFleetScreen.js | New screen: fleet management with Drivers/Vehicles tabs
2026-03-20 | cloudTruckTrucker | src/screens/Supplier/SupplierPayoutsScreen.js | New screen: supplier payouts with pending/approved/paid tabs
2026-03-20 | cloudTruckTrucker | src/components/common/RestrictedScreen.js | New component: lock icon + "Feature Restricted" message shown to employees for gated features
2026-03-20 | cloudTruckTrucker | src/screens/FindLoad/FindLoad.js | Gate with canFindLoad: employees see RestrictedScreen instead of load listing
2026-03-20 | cloudTruckTrucker | src/screens/Profile/WalletScreen.js | Gate with canUseWallet: employees see RestrictedScreen for wallet
2026-03-20 | cloudTruckTrucker | src/screens/Profile/AdvanceScreen.js | Gate with canUseWallet: employees see RestrictedScreen for advance requests
2026-03-20 | cloudTruckTrucker | src/routes/StackNavigation/route.js | Register 5 new screens: RoleSelectScreen, SupplierOnboardingScreen, SupplierProfileScreen, SupplierFleetScreen, SupplierPayoutsScreen
2026-03-20 | cloudtruck-admin | src/app/(dashboard)/indents/page.tsx | Add Suppliers tab to MatchedTrucksModal: shows supplier name/contact/city + linked driver/vehicle/supplierPrice data with call+assign actions; add Suppliers button in row truck-count cell; fix broken state setter names (setIndentTypeEditId→setLoadTypeEditId, setSavingIndentType→setSavingLoadType)
2026-03-20 | cloudtruck-backend | src/scripts/seed-transactional.js | Fix 3 bugs: (1) vehicle null on bookings caused by ...d spread overwriting vehicle Mongoose doc — destructure vehicle def before spread; (2) invalid phone numbers from SEED_TAG.slice(-4) — use fixed PHONE_PREFIX='9100'; (3) createdByStaff missing — add to base() helper; idempotent cleanup now hard-deletes by KNOWN_VEHICLE_NUMBERS/KNOWN_LICENSE_NUMBERS
2026-03-20 | cloudtruck-backend | src/services/booking.service.js | Fix getBookings: populate driver.user.phone and flatten to driver.phone for frontend; fix createdByStaff enrichment to always run regardless of userIds
2026-03-20 | cloudtruck-backend | src/scripts/seed-transactional.js | Add comprehensive transactional seed script: 4 customers, 4 staff, 5 drivers+vehicles (all verified), 20 bookings covering all status tabs (created, under-review, assigned, driver-en-route, reached-pickup, loaded, in-transit, reached-destination, delivered, pod-received, closed, cancelled); all 3 bookingTypes; new Digitify fields (customerPrice, supplierPrice, laneCode, loadType, trafficController, supplier); LR/POD details; idempotent --clean flag
2026-03-20 | cloudtruck-backend | package.json | Add seed:transactional and seed:demo:clean npm scripts
2026-03-20 | cloudtruck-backend | src/scripts/clear-data.js | Add clear-data script that drops all transactional + entity collections while preserving users, organizationSettings, refreshTokens
2026-03-20 | cloudtruck-backend | src/scripts/seed-fresh.js | Add comprehensive fresh seed script seeding permissions (63), role templates (13), master data (85 items across 9 categories), market rates (30 routes), branches (5), and primary company bank account
2026-03-20 | cloudtruck-backend | package.json | Add clear-data and seed:fresh npm scripts
2026-03-20 | cloudtruck-backend | src/controllers/supplier.controller.js | Fix CRITICAL: getMyProfile and updateMyProfile used req.user._id (User._id) with getSupplierById() which expects Supplier._id → always 404; fix by using Supplier.findOne({ user: req.user._id }) directly
2026-03-20 | cloudTruckTrucker | src/screens/Auth/SupplierOnboardingScreen.js | Fix HIGH: was using apiPost but backend route is PATCH /suppliers/my-profile; changed to apiPatch
2026-03-20 | cloudTruckTrucker | src/screens/Splash/Splash1.js | Fix HIGH: final onboarding slide and skip both navigated to 'Login', bypassing RoleSelectScreen; now navigate to 'RoleSelectScreen'
2026-03-20 | cloudTruckTrucker | src/screens/Splash/SplashScreen.js | Fix MEDIUM: supplier resume was dispatching Supplier doc to Redux (missing role field); now always dispatches cachedUser (User object); also removed verificationStatus=pending routing condition that re-sent verified suppliers to onboarding
2026-03-20 | cloudTruckTrucker | src/screens/Auth/Login.js | Fix MEDIUM: removed verificationStatus=pending condition from supplier routing check — verified suppliers were re-routed to onboarding on every login
2026-03-20 | cloudTruckTrucker | src/screens/Profile/Profile.js | Fix HIGH: make Profile screen fully persona-aware; fetchProfile branches on isSupplier (MY_SUPPLIER_PROFILE vs MY_PROFILE); financialItems 3-way conditional (supplier/employee/driver); accountMenuItems 3-way conditional; header badge shows supplier verification status instead of driver KYC badges
2026-03-20 | cloudTruckTrucker | src/routes/TabNavigation/TabNavigation.js | Fix MEDIUM: gate TabNavigation with personaReady flag — shows ActivityIndicator until persona is resolved, preventing persona-dependent UI from rendering with stale data
2026-03-20 | cloudTruckTrucker | src/screens/FindLoad/FindLoad.js | Fix LOW: add canFindLoad guard inside fetchLoads useEffect so API is never called for employees (previously only blocked at render, not at fetch)
2026-03-20 | cloudTruckTrucker | src/screens/Supplier/SupplierFleetScreen.js, src/screens/Supplier/SupplierPayoutsScreen.js | Fix LOW: remove unused FONTS_FAMILY import from both supplier screens
