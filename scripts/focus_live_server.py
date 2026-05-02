#!/usr/bin/env python3
# coding=utf-8
"""
Servidor WebSocket en la Raspberry: captura GigE (MVSDK), JPEG, envío binario.
Copiar junto a mvsdk.py, p. ej.: ~/MVSDK/demo/python_demo/focus_live_server.py

Dependencias: sudo apt install python3-opencv python3-websockets
Ejecutar: sudo python3 focus_live_server.py
"""

import asyncio
import cv2
import numpy as np
import mvsdk
import platform
import websockets
import signal
import sys


HOST = "0.0.0.0"
PORT = 8765

FRAME_WIDTH = 800
FRAME_HEIGHT = 600
JPEG_QUALITY = 70
TARGET_FPS = 8

EXPOSURE_MS = 30


class LiveCamera:
    def __init__(self):
        self.h_camera = 0
        self.cap = None
        self.p_frame_buffer = 0
        self.mono_camera = True

    def open(self):
        dev_list = mvsdk.CameraEnumerateDevice()
        if len(dev_list) < 1:
            raise RuntimeError("No camera was found.")

        dev_info = dev_list[0]
        print(f"Opening camera: {dev_info.GetFriendlyName()} {dev_info.GetPortType()}")

        try:
            self.h_camera = mvsdk.CameraInit(dev_info, -1, -1)
        except mvsdk.CameraException as e:
            raise RuntimeError(f"CameraInit failed ({e.error_code}): {e.message}")

        self.cap = mvsdk.CameraGetCapability(self.h_camera)
        self.mono_camera = self.cap.sIspCapacity.bMonoSensor != 0

        if self.mono_camera:
            mvsdk.CameraSetIspOutFormat(self.h_camera, mvsdk.CAMERA_MEDIA_TYPE_MONO8)
        else:
            mvsdk.CameraSetIspOutFormat(self.h_camera, mvsdk.CAMERA_MEDIA_TYPE_BGR8)

        mvsdk.CameraSetTriggerMode(self.h_camera, 0)

        # Manual exposure for focus calibration
        mvsdk.CameraSetAeState(self.h_camera, 0)
        mvsdk.CameraSetExposureTime(self.h_camera, EXPOSURE_MS * 1000)

        frame_buffer_size = (
            self.cap.sResolutionRange.iWidthMax
            * self.cap.sResolutionRange.iHeightMax
            * (1 if self.mono_camera else 3)
        )

        self.p_frame_buffer = mvsdk.CameraAlignMalloc(frame_buffer_size, 16)

        mvsdk.CameraPlay(self.h_camera)

        print("Camera live stream started.")

    def close(self):
        if self.h_camera:
            try:
                mvsdk.CameraUnInit(self.h_camera)
            except Exception:
                pass
            self.h_camera = 0

        if self.p_frame_buffer:
            try:
                mvsdk.CameraAlignFree(self.p_frame_buffer)
            except Exception:
                pass
            self.p_frame_buffer = 0

        print("Camera closed.")

    def get_jpeg_frame(self):
        try:
            p_raw_data, frame_head = mvsdk.CameraGetImageBuffer(self.h_camera, 200)

            mvsdk.CameraImageProcess(
                self.h_camera,
                p_raw_data,
                self.p_frame_buffer,
                frame_head
            )

            mvsdk.CameraReleaseImageBuffer(self.h_camera, p_raw_data)

            if platform.system() == "Windows":
                mvsdk.CameraFlipFrameBuffer(self.p_frame_buffer, frame_head, 1)

            frame_data = (mvsdk.c_ubyte * frame_head.uBytes).from_address(self.p_frame_buffer)
            frame = np.frombuffer(frame_data, dtype=np.uint8)

            channels = 1 if frame_head.uiMediaType == mvsdk.CAMERA_MEDIA_TYPE_MONO8 else 3
            frame = frame.reshape((frame_head.iHeight, frame_head.iWidth, channels))

            frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT), interpolation=cv2.INTER_LINEAR)

            if channels == 1:
                # OpenCV can encode grayscale directly, but converting to BGR helps browser consistency
                frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)

            ok, jpeg = cv2.imencode(
                ".jpg",
                frame,
                [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
            )

            if not ok:
                return None

            return jpeg.tobytes()

        except mvsdk.CameraException as e:
            if e.error_code != mvsdk.CAMERA_STATUS_TIME_OUT:
                print(f"CameraGetImageBuffer failed ({e.error_code}): {e.message}")
            return None


camera = None


async def live_handler(websocket):
    global camera

    client = websocket.remote_address
    print(f"Client connected: {client}")

    frame_period = 1.0 / TARGET_FPS

    try:
        while True:
            if camera is None:
                await asyncio.sleep(0.1)
                continue

            jpeg_bytes = camera.get_jpeg_frame()

            if jpeg_bytes is not None:
                await websocket.send(jpeg_bytes)

            await asyncio.sleep(frame_period)

    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected: {client}")

    except Exception as e:
        print(f"WebSocket error with {client}: {e}")


async def main():
    global camera

    camera = LiveCamera()
    camera.open()

    print(f"WebSocket live server running on ws://{HOST}:{PORT}")
    print("Press Ctrl+C to stop.")

    async with websockets.serve(
        live_handler,
        HOST,
        PORT,
        max_size=None,
        compression=None
    ):
        await asyncio.Future()


def shutdown_handler(sig, frame):
    global camera

    print("\nStopping live server...")

    if camera is not None:
        camera.close()

    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    try:
        asyncio.run(main())
    finally:
        if camera is not None:
            camera.close()
