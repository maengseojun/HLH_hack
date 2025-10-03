import type { NextApiRequest, NextApiResponse } from "next";
// @ts-ignore - compiled Express app is available at runtime via NodeNext module resolution
import app from "../src/index.js";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return (app as unknown as (req: NextApiRequest, res: NextApiResponse) => void)(req, res);
}
