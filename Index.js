import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { checkItemPrice } from './checkItemPrice.js'; // adjust path if needed

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/checkPrice", async (req, res) => {
  const itemName = req.query.item;
  if (!itemName) return res.status(400).json({ error: "Missing item name" });

  try {
    const result = await checkItemPrice(itemName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
