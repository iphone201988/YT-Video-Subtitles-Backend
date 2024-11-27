import express from "express";
import "dotenv/config";
import router from "./src/routes/index.js";
import morgan from "morgan";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import cors from "cors";


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(morgan("tiny"));
app.use(express.json());
app.use(cors());

app.use("/uploads", express.static(path.join(__dirname, "/src/uploads")));

app.use(express.static(path.join(__dirname, "/src/uploads")));
app.use("/api", router);

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});
app.listen(process.env.PORT, () => {
  console.log(`Server started on ${process.env.PORT}`);
});
