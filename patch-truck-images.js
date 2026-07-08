import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MasterData from './src/models/masterData.model.js';

dotenv.config();

const TRUCK_IMAGES = {
  'tata-ace': 'https://images.unsplash.com/photo-1626244675549-36d933355529?q=80\&w=600',
  'pickup-8ft': 'https://images.unsplash.com/photo-1591862343831-274e7df65007?q=80\&w=600',
  'pickup-10ft': 'https://images.unsplash.com/photo-1586191712102-141e6e4f9712?q=80\&w=600',
  'tata-407': 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80\&w=600',
  'eicher-14ft': 'https://images.unsplash.com/photo-1519003722824-192d992a6023?q=80\&w=600',
  'eicher-17ft': 'https://images.unsplash.com/photo-1616432043562-3671ea2e5258?q=80\&w=600',
  'eicher-19ft': 'https://images.unsplash.com/photo-1501700493788-fa1a4fc9fe62?q=80\&w=600',
  'taurus-16': 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5962?q=80\&w=600',
  'taurus-25': 'https://images.unsplash.com/photo-1580674684081-7617fbf391f3?q=80\&w=600',
  '32ft-sxl': 'https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?q=80\&w=600',
  '32ft-mxl': 'https://images.unsplash.com/photo-1606405291253-ab20d9d20c4e?q=80\&w=600',
  'container-20ft': 'https://images.unsplash.com/photo-1494412519320-aa613dfb7738?q=80\&w=600',
  'container-32ft': 'https://images.unsplash.com/photo-1586191712102-141e6e4f9712?q=80\&w=600',
  'container-40ft': 'https://images.unsplash.com/photo-1506306850422-920406692985?q=80\&w=600',
  '22ft-odc': 'https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?q=80\&w=600',
};

const patchTruckImages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');
    const trucks = await MasterData.find({ category: 'truck-type' });
    for (const t of trucks) {
      if (TRUCK_IMAGES[t.key]) {
        t.imageUrl = TRUCK_IMAGES[t.key];
        await t.save();
        console.log('Patched ' + t.displayName);
      }
    }
    console.log('Done');
    process.exit(0);
  } catch (e) {
    if (e.message.includes('whitelist')) {
      console.log('AGENT_BLOCKED');
    } else {
      console.error(e.message);
    }
    process.exit(1);
  }
};

patchTruckImages();