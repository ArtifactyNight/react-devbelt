import type { NextConfig } from "next";
import { withDevBelt } from "react-devbelt/next";

const nextConfig: NextConfig = {};

// Loads devbelt's capture code before hydration (Next 16.3+).
export default withDevBelt(nextConfig);
