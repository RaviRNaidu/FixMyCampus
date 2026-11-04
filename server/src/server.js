import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
const port=process.env.PORT||5000;
if(!process.env.JWT_SECRET) { console.error('JWT_SECRET is required. Copy server/.env.example to server/.env and configure it.'); process.exit(1); }
try { await connectDB(); app.listen(port,()=>console.log(`FixMyCampus API listening on ${port}`)); } catch(error) { console.error('Could not connect to MongoDB:',error.message); process.exit(1); }
