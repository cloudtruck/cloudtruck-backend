# Backend Directory Tree

Generated: 2025-12-11

```
backend
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── src
    ├── app.js
    ├── config
    │   ├── cloudinary.js
    │   ├── constants.js
    │   ├── database.js
    │   ├── firebase.js
    │   ├── phonepe.js
    │   └── redis.js
    ├── controllers
    │   ├── auth.controller.js
    │   ├── booking.controller.js
    │   ├── customer.controller.js
    │   ├── document.controller.js
    │   ├── driver.controller.js
    │   ├── notification.controller.js
    │   ├── payment.controller.js
    │   ├── staff.controller.js
    │   └── tracking.controller.js
    ├── middlewares
    │   ├── auth.middleware.js
    │   ├── errorHandler.middleware.js
    │   ├── rateLimiter.middleware.js
    │   ├── requirePermission.js
    │   ├── roleCheck.middleware.js
    │   ├── upload.middleware.js
    │   └── validation.middleware.js
    ├── models
    │   ├── auditLog.model.js
    │   ├── booking.model.js
    │   ├── customer.model.js
    │   ├── document.model.js
    │   ├── driver.model.js
    │   ├── payment.model.js
    │   ├── permission.model.js
    │   ├── refreshToken.model.js
    │   ├── staff.model.js
    │   ├── tracking.model.js
    │   ├── user.model.js
    │   └── vehicle.model.js
    ├── routes (empty)
    ├── scripts
    │   └── seed-rbac.js
    ├── services
    │   ├── document.service.js
    │   ├── firebase.service.js
    │   ├── location.service.js
    │   ├── notification.service.js
    │   ├── payment.service.js
    │   └── tracking.service.js
    ├── sockets
    │   ├── notification.socket.js
    │   └── tracking.socket.js
    ├── utils
    │   ├── ApiError.js
    │   ├── ApiResponse.js
    │   ├── asyncHandler.js
    │   ├── helpers.js
    │   ├── logger.js
    │   └── validators.js
    └── validators
        ├── auth.validator.js
        ├── booking.validator.js
        ├── driver.validator.js
        └── payment.validator.js
```
