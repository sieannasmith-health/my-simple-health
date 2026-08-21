export default function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed."
        });
    }

    return res.status(200).json({
        success: true,
        message: "Hello backend is connected."
    });

}
