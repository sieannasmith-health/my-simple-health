export default function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed."
        });
    }

    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
        return res.status(400).json({
            success: false,
            message: "A message is required."
        });
    }

    return res.status(200).json({
        success: true,
        receivedMessage: message,
        route: "TEST",
        response: "Hello backend received your message."
    });

}
