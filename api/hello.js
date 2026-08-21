// My Simple Health AI backend
export default function handler(req, res) {

    res.setHeader(
    "Access-Control-Allow-Origin",
    "https://mysimplehealth.org"
);

res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
);

res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
);
    if (req.method === "OPTIONS") {
    return res.status(200).end();
}

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

    const route =
        classifyRequest(message);

    return res.status(200).json({
        success: true,
        route: route,
        response: getRouteResponse(route)
    });

}


/* =========================================================
   SAFETY / SCOPE CLASSIFIER
========================================================= */

function classifyRequest(message) {

    const text =
        message
            .toLowerCase()
            .trim();


    /* =========================================
       SAFETY — MEDICAL EMERGENCY
    ========================================== */

    const medicalEmergencyPatterns = [

        "severe chest pain",
        "crushing chest pain",
        "can't breathe",
        "cannot breathe",
        "difficulty breathing right now",
        "signs of stroke",
        "face drooping",
        "passed out",
        "unconscious",
        "severe allergic reaction",
        "heavy bleeding",
        "severe bleeding"

    ];


    if (
        medicalEmergencyPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return "SAFETY_MEDICAL";

    }


    /* =========================================
       SAFETY — CRISIS
    ========================================== */

    const crisisPatterns = [

        "i want to kill myself",
        "i'm going to kill myself",
        "i am going to kill myself",
        "i want to die",
        "hurt myself right now",
        "harm myself right now",
        "suicidal"

    ];


    if (
        crisisPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return "SAFETY_CRISIS";

    }


    /* =========================================
       RED
    ========================================== */

    const redPatterns = [

        "diagnose me",
        "what disease do i have",
        "tell me what disease i have",
        "do i have cancer",
        "do i have diabetes",
        "do i have depression",
        "interpret my labs",
        "interpret these labs",
        "interpret my bloodwork",
        "change my medication",
        "change my dose",
        "stop my medication",
        "should i stop taking",
        "should i stop my medication",
        "prescribe me",
        "prescribe medication",
        "what dose should i take",
        "am i medically cleared",
        "clear me for exercise",
        "tell me if it is safe for me to exercise"

    ];


    if (
        redPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return "RED";

    }


    /* =========================================
       YELLOW
    ========================================== */

    const yellowPatterns = [

        "i have diabetes",
        "i have hypertension",
        "i have high blood pressure",
        "i have heart disease",
        "i have kidney disease",
        "i have cancer",
        "i am pregnant",
        "i'm pregnant",
        "my medication",
        "my prescription",
        "my lab",
        "my bloodwork",
        "my cholesterol",
        "my glucose",
        "my blood pressure",
        "my doctor said",
        "i was diagnosed",
        "i have anxiety",
        "i have depression",
        "i have an eating disorder"

    ];


    if (
        yellowPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return "YELLOW";

    }


    return "GREEN";

}


/* =========================================================
   ROUTE RESPONSES
========================================================= */

function getRouteResponse(route) {

    if (route === "GREEN") {

        return "This falls within Hello's general education and wellness lane.";

    }


    if (route === "YELLOW") {

        return "This includes individual medical context. Hello can provide general education, but should avoid individualized diagnosis or treatment decisions.";

    }


    if (route === "RED") {

        return "This request crosses into individualized clinical diagnosis, prescribing, treatment, medical-data interpretation, or medical clearance. Hello should not perform that action.";

    }


    if (route === "SAFETY_MEDICAL") {

        return "This may be a medical emergency. Please call 911 or your local emergency number now, or go to the nearest emergency department.";

    }


    if (route === "SAFETY_CRISIS") {

        return "This may be an immediate emotional or suicide crisis. In the United States, call or text 988. If there is immediate danger or you cannot stay safe, call 911 or go to the nearest emergency department.";

    }


    return "Hello could not classify this request.";

}
