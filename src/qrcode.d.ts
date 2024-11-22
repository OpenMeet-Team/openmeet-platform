declare module 'qrcode' {
    interface QRCodeOptions {
        width?: number;
        margin?: number;
        color?: {
            dark?: string; // Color for the dark part of the QR code
            light?: string; // Color for the light part of the QR code
        };
    }

    interface QRCode {
        toCanvas(
            canvas?: HTMLCanvasElement,
            text?: string,
            options?: QRCodeOptions,
            callback?: (error: Error | null) => void
        ): void;
    }

    const QRCode: QRCode
    export default QRCode
}
