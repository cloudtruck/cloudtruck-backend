import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MarketRate from '../models/marketRate.model.js';

dotenv.config();

const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
const years =  [2025, 2025, 2025, 2025, 2026, 2026];

/**
 * Generate 6 months of price trend data with realistic fluctuations
 */
const generateTrends = (basePrice) => {
  return months.map((month, i) => {
    const fluctuation = 1 + (Math.random() * 0.12 - 0.06); // ±6%
    return {
      month,
      year: years[i],
      price: Math.round(basePrice * fluctuation)
    };
  });
};

// truckType values match master data keys from 'truck-type' category
const marketRates = [
  // Mumbai routes
  { fromCity: 'Mumbai', toCity: 'Delhi', truckType: '32ft-mxl', price: 42000, distance: 1400, estimatedTime: '24-28 hrs', bookingCount: 1250 },
  { fromCity: 'Mumbai', toCity: 'Delhi', truckType: 'eicher-19ft', price: 35000, distance: 1400, estimatedTime: '24-28 hrs', bookingCount: 980 },
  { fromCity: 'Mumbai', toCity: 'Bangalore', truckType: '32ft-mxl', price: 28000, distance: 980, estimatedTime: '16-20 hrs', bookingCount: 870 },
  { fromCity: 'Mumbai', toCity: 'Bangalore', truckType: 'container-20ft', price: 22000, distance: 980, estimatedTime: '16-20 hrs', bookingCount: 650 },
  { fromCity: 'Mumbai', toCity: 'Chennai', truckType: '32ft-mxl', price: 38000, distance: 1340, estimatedTime: '22-26 hrs', bookingCount: 720 },
  { fromCity: 'Mumbai', toCity: 'Ahmedabad', truckType: 'eicher-19ft', price: 15000, distance: 530, estimatedTime: '8-10 hrs', bookingCount: 1100 },
  { fromCity: 'Mumbai', toCity: 'Pune', truckType: 'eicher-17ft', price: 8500, distance: 150, estimatedTime: '3-4 hrs', bookingCount: 2200 },
  { fromCity: 'Mumbai', toCity: 'Kolkata', truckType: '32ft-mxl', price: 52000, distance: 2050, estimatedTime: '32-36 hrs', bookingCount: 430 },
  { fromCity: 'Mumbai', toCity: 'Hyderabad', truckType: 'eicher-19ft', price: 28000, distance: 710, estimatedTime: '12-14 hrs', bookingCount: 890 },

  // Delhi routes
  { fromCity: 'Delhi', toCity: 'Mumbai', truckType: '32ft-mxl', price: 43000, distance: 1400, estimatedTime: '24-28 hrs', bookingCount: 1180 },
  { fromCity: 'Delhi', toCity: 'Kolkata', truckType: '32ft-mxl', price: 43500, distance: 1530, estimatedTime: '26-30 hrs', bookingCount: 760 },
  { fromCity: 'Delhi', toCity: 'Kolkata', truckType: 'taurus-25', price: 35000, distance: 1530, estimatedTime: '26-30 hrs', bookingCount: 520 },
  { fromCity: 'Delhi', toCity: 'Chennai', truckType: '32ft-mxl', price: 55000, distance: 2180, estimatedTime: '34-38 hrs', bookingCount: 380 },
  { fromCity: 'Delhi', toCity: 'Bangalore', truckType: '32ft-sxl', price: 48000, distance: 2150, estimatedTime: '34-38 hrs', bookingCount: 410 },
  { fromCity: 'Delhi', toCity: 'Ahmedabad', truckType: 'container-20ft', price: 25000, distance: 940, estimatedTime: '14-16 hrs', bookingCount: 670 },

  // Bangalore routes
  { fromCity: 'Bangalore', toCity: 'Chennai', truckType: 'eicher-17ft', price: 12500, distance: 350, estimatedTime: '6-7 hrs', bookingCount: 1800 },
  { fromCity: 'Bangalore', toCity: 'Chennai', truckType: 'eicher-19ft', price: 16000, distance: 350, estimatedTime: '6-7 hrs', bookingCount: 950 },
  { fromCity: 'Bangalore', toCity: 'Hyderabad', truckType: '32ft-mxl', price: 22000, distance: 570, estimatedTime: '9-11 hrs', bookingCount: 780 },
  { fromCity: 'Bangalore', toCity: 'Mumbai', truckType: '32ft-mxl', price: 29000, distance: 980, estimatedTime: '16-20 hrs', bookingCount: 830 },

  // Chennai routes
  { fromCity: 'Chennai', toCity: 'Bangalore', truckType: '32ft-mxl', price: 13000, distance: 350, estimatedTime: '6-7 hrs', bookingCount: 1650 },
  { fromCity: 'Chennai', toCity: 'Hyderabad', truckType: 'eicher-19ft', price: 24000, distance: 630, estimatedTime: '10-12 hrs', bookingCount: 690 },
  { fromCity: 'Chennai', toCity: 'Kolkata', truckType: '32ft-mxl', price: 48000, distance: 1670, estimatedTime: '28-32 hrs', bookingCount: 320 },

  // Pune routes
  { fromCity: 'Pune', toCity: 'Mumbai', truckType: 'eicher-17ft', price: 8000, distance: 150, estimatedTime: '3-4 hrs', bookingCount: 2100 },
  { fromCity: 'Pune', toCity: 'Bangalore', truckType: 'eicher-19ft', price: 25000, distance: 840, estimatedTime: '14-16 hrs', bookingCount: 580 },

  // Ahmedabad routes
  { fromCity: 'Ahmedabad', toCity: 'Mumbai', truckType: '32ft-mxl', price: 16000, distance: 530, estimatedTime: '8-10 hrs', bookingCount: 1050 },
  { fromCity: 'Ahmedabad', toCity: 'Delhi', truckType: 'eicher-19ft', price: 26000, distance: 940, estimatedTime: '14-16 hrs', bookingCount: 640 },

  // Kolkata routes
  { fromCity: 'Kolkata', toCity: 'Delhi', truckType: '32ft-mxl', price: 44000, distance: 1530, estimatedTime: '26-30 hrs', bookingCount: 710 },
  { fromCity: 'Kolkata', toCity: 'Chennai', truckType: 'taurus-25', price: 40000, distance: 1670, estimatedTime: '28-32 hrs', bookingCount: 280 },

  // Hyderabad routes
  { fromCity: 'Hyderabad', toCity: 'Bangalore', truckType: 'container-20ft', price: 18000, distance: 570, estimatedTime: '9-11 hrs', bookingCount: 720 },
  { fromCity: 'Hyderabad', toCity: 'Mumbai', truckType: '32ft-mxl', price: 30000, distance: 710, estimatedTime: '12-14 hrs', bookingCount: 650 },
];

const seedMarketRates = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    console.log('Seeding market rates...');

    await Promise.all(
      marketRates.map((rate) => {
        const data = {
          ...rate,
          priceTrends: generateTrends(rate.price)
        };

        return MarketRate.findOneAndUpdate(
          { fromCity: rate.fromCity, toCity: rate.toCity, truckType: rate.truckType },
          { $set: data },
          { upsert: true, new: true }
        );
      })
    );

    console.log(`Seeded ${marketRates.length} market rates successfully`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error seeding market rates:', err);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
  }
};

seedMarketRates();
