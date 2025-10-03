/// <reference path="./types.d.ts" />
import type { NextApiRequest, NextApiResponse } from "next";
import app from "../dist/index.js";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return (app as unknown as (req: NextApiRequest, res: NextApiResponse) => void)(req, res);
}
