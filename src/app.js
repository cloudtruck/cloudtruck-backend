import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import routes from './routes/index.js';
import errorHandler from './middlewares/errorHandler.middleware.js';
import { globalLimiter } from './middlewares/rateLimiter.middleware.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(mongoSanitize()); // Prevent NoSQL injection

// CORS configuration
const corsOptions = {
  origin: true, // Allow all origins in development
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
app.use(globalLimiter);

// API routes
app.use('/api/v1', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cloudtruck API Server',
    version: '1.0.0',
    documentation: '/api/v1/health'
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
