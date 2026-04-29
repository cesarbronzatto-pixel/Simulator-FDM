import { generatePersona } from './src/services/gemini.js';
import * as dotenv from 'dotenv';
dotenv.config();

generatePersona().then(console.log).catch(console.error);
