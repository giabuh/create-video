/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { existsSync } from "node:fs";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setChromiumOpenGlRenderer("vulkan"); // GPU raster, ~4x faster than CPU SwiftShader
// Same encoder choice as app/server/render.ts: NVENC 12 Mbps with an NVIDIA driver, else x264 veryfast/CRF 16.
if (existsSync("/dev/nvidiactl")) {
  Config.setHardwareAcceleration("required");
  Config.setVideoBitrate("12M");
} else {
  Config.setX264Preset("veryfast");
  Config.setCrf(16);
}
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
