import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Global variable to store sphere position
let spherePosition = { x: 0, y: 2, z: 0 };

// POST endpoint to update sphere position
app.post('/move-sphere', (req, res) => {
    const { x, y, z } = req.body;
    if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
        spherePosition = { x, y, z };
        res.json({ success: true, position: spherePosition });
    } else {
        res.status(400).json({ 
            success: false, 
            error: 'Invalid position data. Expected numbers for x, y, z coordinates.' 
        });
    }
});

// GET endpoint to retrieve current sphere position
app.get('/sphere-position', (req, res) => {
    res.json(spherePosition);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
