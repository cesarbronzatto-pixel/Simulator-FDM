import { generateAvatar } from './src/services/gemini.js';
import * as dotenv from 'dotenv';
dotenv.config();

generateAvatar('Professional portrait of a serious Brazilian female judge in her 60s').then(r => console.log('Avatar generated', r.length)).catch(console.error);
