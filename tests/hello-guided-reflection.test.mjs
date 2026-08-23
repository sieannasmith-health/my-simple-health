import assert from "node:assert/strict";
import {
    readFileSync
} from "node:fs";
import test from "node:test";
import vm from "node:vm";


const helloHTML =
    readFileSync(
        new URL(
            "../hello.html",
            import.meta.url
        ),
        "utf8"
    );

const inlineScript =
    helloHTML.match(
        /<script>([\s\S]*?)<\/script>/i
    )?.[1];


assert.ok(
    inlineScript,
    "hello.html must contain its inline application script"
);


class FakeClassList {

    constructor(element) {
        this.element = element;
    }


    add(...names) {
        names.forEach(
            name => this.element.classes.add(name)
        );
    }


    contains(name) {
        return this.element.classes.has(name);
    }


    remove(...names) {
        names.forEach(
            name => this.element.classes.delete(name)
        );
    }


    toggle(name, force) {

        const shouldAdd =
            force === undefined
                ? !this.contains(name)
                : Boolean(force);


        if (shouldAdd) {
            this.add(name);
        }

        else {
            this.remove(name);
        }


        return shouldAdd;
    }

}


class FakeElement {

    constructor(tagName = "div", id = "") {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.children = [];
        this.classes = new Set();
        this.classList = new FakeClassList(this);
        this.disabled = false;
        this.href = "";
        this.parentNode = null;
        this.style = {};
        this.value = "";
        this._innerHTML = "";
        this._textContent = "";
    }


    addEventListener() {}


    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }


    get className() {
        return [...this.classes].join(" ");
    }


    set className(value) {
        this.classes =
            new Set(
                String(value || "")
                    .split(/\s+/)
                    .filter(Boolean)
            );
    }


    get innerHTML() {

        if (this._innerHTML) {
            return this._innerHTML;
        }


        return escapeText(
            this._textContent
        );
    }


    set innerHTML(value) {
        this._innerHTML = String(value || "");
        this._textContent = "";

        if (!this._innerHTML) {
            this.children = [];
        }
    }


    remove() {

        if (!this.parentNode) {
            return;
        }


        this.parentNode.children =
            this.parentNode.children.filter(
                child => child !== this
            );

        this.parentNode = null;
    }


    get scrollHeight() {
        return this.children.length;
    }


    set scrollTop(_value) {}


    get textContent() {
        return this._textContent;
    }


    set textContent(value) {
        this._textContent = String(value || "");
        this._innerHTML = "";
        this.children = [];
    }

}


function escapeText(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function createValidState(overrides = {}) {

    return {
        mode: "wellness_reflection",
        source: "wellness-wheel",
        selectedDimension:
            "Physical Wellness",
        selectedDimensionKey:
            "physical",
        selectedScore: 5,
        wheelScores: {
            physical: 5,
            emotional: 5,
            social: 5,
            occupational: 5,
            financial: 5,
            environmental: 5,
            intellectual: 5,
            spiritual: 5
        },
        currentStep: 0,
        answers: {
            workingWell: "",
            desiredChange: "",
            whyMatters: "",
            strengths: "",
            barriers: "",
            goal: "",
            actionStep: "",
            confidence: ""
        },
        ...overrides
    };

}


function createHarness(
    savedState,
    {
        fetchImplementation
    } = {}
) {

    const elements =
        new Map();

    const requiredIds = [
        "askModeButton",
        "guidedModeButton",
        "helloChat",
        "helloContext",
        "helloInput",
        "helloInputWrap",
        "helloSendButton"
    ];


    for (const id of requiredIds) {
        elements.set(
            id,
            new FakeElement(
                id === "helloInput"
                    ? "textarea"
                    : id.includes("Button")
                        ? "button"
                        : "div",
                id
            )
        );
    }


    const storage =
        new Map();

    if (savedState !== undefined) {
        storage.set(
            "helloWellnessState",
            JSON.stringify(savedState)
        );
    }


    const timers = [];

    const fetchCalls = [];

    const document = {
        createElement(tagName) {
            return new FakeElement(tagName);
        },

        getElementById(id) {
            return elements.get(id) || null;
        },

        querySelector() {
            return new FakeElement("nav");
        }
    };

    const sessionStorage = {
        getItem(key) {
            return storage.has(key)
                ? storage.get(key)
                : null;
        },

        setItem(key, value) {
            storage.set(key, String(value));
        }
    };

    const context =
        vm.createContext({
            AbortController,
            console,
            document,
            fetch: async (url, options) => {

                fetchCalls.push({
                    url,
                    options
                });


                if (fetchImplementation) {
                    return fetchImplementation(
                        url,
                        options
                    );
                }


                return createGuidedResponse();

            },
            sessionStorage,
            setTimeout(callback, delay) {
                timers.push({
                    callback,
                    delay
                });
                return timers.length;
            },
            window: {
                location: {
                    hostname:
                        "preview.example",
                    href: ""
                }
            }
        });


    vm.runInContext(
        inlineScript,
        context,
        {
            filename: "hello.html"
        }
    );


    return {
        elements,

        fetchCalls,

        storage,

        flushTimers() {

            const pending =
                timers.splice(
                    0,
                    timers.length
                );


            pending.forEach(
                timer => timer.callback()
            );
        },

        run(source) {
            return vm.runInContext(
                source,
                context
            );
        }
    };

}


function createGuidedResponse({
    response =
        "You already have something to build from. What would you like to work toward?",
    updates = [
        {
            key:
                "currentSuccesses",
            status:
                "complete",
            summary:
                "The user identified something that is already working."
        }
    ],
    nextObjective =
        "goals",
    reflectionComplete =
        false,
    turnFunctions = [
        "OBJECTIVE_CONTENT"
    ],
    route =
        "GREEN",
    offerVisitPrep =
        false
} = {}) {

    const body = {
        success: true,
        route,
        conversationIntent:
            "GUIDED_REFLECTION",
        response,
        guidedReflection: {
            response,
            turnFunctions,
            objectiveUpdates:
                updates,
            nextObjective,
            reflectionComplete
        },
        evidenceAvailable:
            false,
        showEvidence:
            false,
        sources: [],
        offerVisitPrep
    };


    return {
        ok: true,

        async json() {
            return body;
        }
    };

}


function allElements(element) {

    return [
        element,
        ...element.children.flatMap(
            child => allElements(child)
        )
    ];

}


function renderedText(element) {

    return allElements(element)
        .map(item => item.textContent)
        .filter(Boolean)
        .join("\n");

}


function countText(element, text) {

    return allElements(element)
        .filter(
            item => item.textContent === text
        )
        .length;

}


test(
    "Guided mode without Wellness state is explicit and disabled",
    () => {

        const harness =
            createHarness();


        harness.run(
            'switchMode("guided")'
        );


        const chat =
            harness.elements.get("helloChat");
        const input =
            harness.elements.get("helloInput");
        const sendButton =
            harness.elements.get("helloSendButton");
        const links =
            allElements(chat)
                .filter(
                    element => element.tagName === "A"
                );


        assert.match(
            renderedText(chat),
            /Complete the Wellness Wheel first/
        );
        assert.equal(input.disabled, true);
        assert.equal(sendButton.disabled, true);
        assert.equal(links.length, 1);
        assert.equal(
            links[0].href,
            "wellness-wheel.html"
        );
        assert.equal(
            links[0].textContent,
            "GO TO WELLNESS WHEEL →"
        );


        input.value =
            "This must not be silently accepted.";

        const beforeSend =
            renderedText(chat);


        harness.run("handleSend()");


        assert.equal(
            input.value,
            "This must not be silently accepted."
        );
        assert.equal(
            renderedText(chat),
            beforeSend
        );
        assert.equal(
            harness.fetchCalls.length,
            0
        );

    }
);


test(
    "valid same-tab Wellness state initializes the first Guided question once",
    () => {

        const harness =
            createHarness(
                createValidState()
            );
        const chat =
            harness.elements.get("helloChat");


        assert.equal(
            countText(
                chat,
                "What is already going well in this area?"
            ),
            1
        );
        assert.equal(
            harness.elements.get("helloInput").disabled,
            false
        );
        assert.equal(
            harness.elements.get("helloSendButton").disabled,
            false
        );

    }
);


test(
    "Ask to Guided restores controls and renders the current question once",
    () => {

        const harness =
            createHarness(
                createValidState()
            );


        harness.run(
            'switchMode("ask"); switchMode("guided");'
        );


        const chat =
            harness.elements.get("helloChat");


        assert.equal(
            countText(
                chat,
                "What is already going well in this area?"
            ),
            1
        );
        assert.equal(
            harness.elements.get("helloInput").disabled,
            false
        );
        assert.equal(
            harness.elements.get("helloSendButton").disabled,
            false
        );

    }
);


test(
    "direct answer updates the active objective and moves to a useful unresolved objective",
    async () => {

        const harness =
            createHarness(
                createValidState()
            );


        await harness.run(
            'handleGuidedResponse("A test answer")'
        );


        const chat =
            harness.elements.get("helloChat");


        assert.equal(
            harness.run(
                "state.reflection.objectives.currentSuccesses.status"
            ),
            "complete"
        );
        assert.equal(
            harness.run(
                "state.reflection.activeObjective"
            ),
            "goals"
        );
        assert.match(
            renderedText(chat),
            /What would you like to work toward\?/
        );

    }
);


test(
    "mode change still cancels a stale Guided callback",
    async () => {

        const harness =
            createHarness(
                createValidState()
            );


        harness.run(
            'handleGuidedResponse("A test answer"); switchMode("ask");'
        );

        await Promise.resolve();
        await Promise.resolve();

        harness.flushTimers();


        const chatText =
            renderedText(
                harness.elements.get("helloChat")
            );


        assert.doesNotMatch(
            chatText,
            /What would you like to be different\?/
        );
        assert.match(
            chatText,
            /Ask me a general health or wellness question/
        );

    }
);


test(
    "completed Guided reflection renders its existing summary",
    () => {

        const harness =
            createHarness(
            createValidState({
                    currentStep: 8,
                    answers: {
                        workingWell: "",
                        desiredChange: "",
                        whyMatters: "",
                        strengths: "",
                        barriers: "",
                        goal: "A test goal",
                        actionStep: "A test step",
                        confidence: "7"
                    }
                })
            );
        const chatText =
            renderedText(
                harness.elements.get("helloChat")
            );


        assert.match(
            chatText,
            /Your goal: A test goal/
        );
        assert.match(
            chatText,
            /Your next step: A test step/
        );
        assert.match(
            chatText,
            /Confidence: 7\/10/
        );
        assert.doesNotMatch(
            chatText,
            /What is already going well in this area\?/
        );
        assert.equal(
            harness.elements.get("helloInputWrap")
                .style.display,
            "none"
        );

    }
);


test(
    "fresh tab or Preview origin gets the explicit prerequisite experience",
    () => {

        const previousTab =
            createHarness(
                createValidState()
            );
        const freshTab =
            createHarness();


        freshTab.run(
            'switchMode("guided")'
        );


        assert.match(
            renderedText(
                previousTab.elements.get("helloChat")
            ),
            /What is already going well in this area\?/
        );
        assert.match(
            renderedText(
                freshTab.elements.get("helloChat")
            ),
            /Complete the Wellness Wheel first/
        );
        assert.equal(
            freshTab.elements.get("helloInput")
                .disabled,
            true
        );
        assert.equal(
            freshTab.elements.get("helloSendButton")
                .disabled,
            true
        );

    }
);


test(
    "a goal supplied during current-success reflection is stored as a goal without completing current successes",
    async () => {

        const harness =
            createHarness(
                createValidState(),
                {
                    fetchImplementation:
                        async () =>
                            createGuidedResponse({
                                response:
                                    "Those are clear goals. Before moving on, what is already helping you make progress?",
                                updates: [
                                    {
                                        key: "goals",
                                        status: "complete",
                                        summary: "Improve credit health, pay off debt, and save for a home."
                                    }
                                ],
                                nextObjective:
                                    "currentSuccesses"
                            })
                }
            );


        await harness.run(
            'handleGuidedResponse("I want to improve my credit health, pay off debt, and save for a home.")'
        );


        assert.equal(
            harness.run(
                "state.reflection.objectives.goals.status"
            ),
            "complete"
        );
        assert.equal(
            harness.run(
                "state.reflection.objectives.currentSuccesses.status"
            ),
            "unresolved"
        );
        assert.equal(
            harness.run(
                "state.reflection.activeObjective"
            ),
            "currentSuccesses"
        );

    }
);


test(
    "later objectives answered early are retained and not made active again",
    async () => {

        const harness =
            createHarness(
                createValidState(),
                {
                    fetchImplementation:
                        async () =>
                            createGuidedResponse({
                                response:
                                    "You have already identified both a goal and a constraint. What is helping at all right now?",
                                updates: [
                                    {
                                        key: "goals",
                                        status: "complete",
                                        summary: "Build savings."
                                    },
                                    {
                                        key: "barriers",
                                        status: "complete",
                                        summary: "Irregular income makes planning difficult."
                                    }
                                ],
                                nextObjective:
                                    "currentSuccesses"
                            })
                }
            );


        await harness.run(
            'handleGuidedResponse("I want to save, but my income changes every month.")'
        );


        assert.equal(
            harness.run(
                "state.reflection.objectives.barriers.status"
            ),
            "complete"
        );
        assert.notEqual(
            harness.run(
                "state.reflection.activeObjective"
            ),
            "barriers"
        );

    }
);


for (const testCase of [
    {
        name:
            "clarification is answered without completing the active objective",
        input:
            "What do you mean by strengths?",
        response:
            "Strengths can be qualities such as persistence or organization, while resources can be practical tools or guidance. What do you feel you already have going for you?",
        turnFunctions: [
            "CLARIFICATION"
        ]
    },
    {
        name:
            "an example request is answered without advancing",
        input:
            "Can you give me an example?",
        response:
            "A strength could be following through on plans, and a resource could be a budgeting tool. What feels most relevant to you?",
        turnFunctions: [
            "EXAMPLE_REQUEST"
        ]
    },
    {
        name:
            "a direct question is answered before returning to the objective",
        input:
            "Do I have to choose only one strength?",
        response:
            "No. You can name one or several, and we can focus on whatever feels most useful. What comes to mind first?",
        turnFunctions: [
            "DIRECT_QUESTION"
        ]
    },
    {
        name:
            "uncertainty prompts exploration instead of mechanical advancement",
        input:
            "I don't know.",
        response:
            "We can make it smaller. Is there anything that has made this even slightly easier before?",
        turnFunctions: [
            "UNCERTAINTY"
        ]
    }
]) {

    test(
        testCase.name,
        async () => {

            const state =
                createValidState({
                    reflection: {
                        version: 1,
                        activeObjective:
                            "strengthsResources",
                        turnNumber: 0,
                        objectives: {}
                    }
                });

            const harness =
                createHarness(
                    state,
                    {
                        fetchImplementation:
                            async () =>
                                createGuidedResponse({
                                    response:
                                        testCase.response,
                                    updates: [],
                                    nextObjective:
                                        "strengthsResources",
                                    turnFunctions:
                                        testCase.turnFunctions
                                })
                    }
                );


            await harness.run(
                `handleGuidedResponse(${JSON.stringify(testCase.input)})`
            );


            assert.equal(
                harness.run(
                    "state.reflection.activeObjective"
                ),
                "strengthsResources"
            );
            assert.equal(
                harness.run(
                    "state.reflection.objectives.strengthsResources.status"
                ),
                "unresolved"
            );
            assert.match(
                renderedText(
                    harness.elements.get("helloChat")
                ),
                new RegExp(
                    escapeText(
                        testCase.response.split(".")[0]
                    ).replace(
                        /&(?:#\d+|[a-z]+);/gi,
                        ".*"
                    ),
                    "i"
                )
            );

        }
    );

}


test(
    "corrections replace prior structured context",
    async () => {

        const state =
            createValidState();
        const harness =
            createHarness(
                state,
                {
                    fetchImplementation:
                        async () =>
                            createGuidedResponse({
                                response:
                                    "Thanks for correcting that. The main barrier is time, not cost. What tends to take up that time?",
                                updates: [
                                    {
                                        key: "barriers",
                                        status: "complete",
                                        summary: "Limited time is the main barrier, not cost."
                                    }
                                ],
                                nextObjective:
                                    "barriers",
                                turnFunctions: [
                                    "CORRECTION",
                                    "OBJECTIVE_CONTENT"
                                ]
                            })
                }
            );


        harness.run(
            'ensureReflectionState(); state.reflection.objectives.barriers = {status:"complete", summary:"Cost is the barrier.", updatedAtTurn:1};'
        );

        await harness.run(
            'handleGuidedResponse("Actually, cost is not the problem. It is time.")'
        );


        assert.equal(
            harness.run(
                "state.reflection.objectives.barriers.summary"
            ),
            "Limited time is the main barrier, not cost."
        );

    }
);


test(
    "early barriers, strengths, and cross-domain context are retained without changing Wellness focus",
    async () => {

        const financialState =
            createValidState({
                selectedDimension:
                    "Financial Wellness",
                selectedDimensionKey:
                    "financial",
                selectedScore: 4,
                wheelScores: {
                    physical: 5,
                    emotional: 5,
                    social: 3,
                    occupational: 5,
                    financial: 4,
                    environmental: 5,
                    intellectual: 5,
                    spiritual: 5
                }
            });

        const harness =
            createHarness(
                financialState,
                {
                    fetchImplementation:
                        async () =>
                            createGuidedResponse({
                                response:
                                    "You are handling this with persistence, and limited support is relevant context. What is already helping with the financial goal itself?",
                                updates: [
                                    {
                                        key: "barriers",
                                        status: "partial",
                                        summary: "Limited support makes the goal harder."
                                    },
                                    {
                                        key: "strengthsResources",
                                        status: "complete",
                                        summary: "The user has been persistent."
                                    },
                                    {
                                        key: "socialContext",
                                        status: "complete",
                                        summary: "The user has few people available for support."
                                    }
                                ],
                                nextObjective:
                                    "currentSuccesses"
                            })
                }
            );


        await harness.run(
            'handleGuidedResponse("I do not have many people in my life, but I have kept trying.")'
        );


        assert.equal(
            harness.run(
                "state.selectedDimension"
            ),
            "Financial Wellness"
        );
        assert.equal(
            harness.run(
                "state.reflection.objectives.socialContext.status"
            ),
            "complete"
        );
        assert.equal(
            harness.run(
                "state.reflection.objectives.strengthsResources.status"
            ),
            "complete"
        );

    }
);


test(
    "readiness hesitation does not force action planning",
    async () => {

        const harness =
            createHarness(
                createValidState(),
                {
                    fetchImplementation:
                        async () =>
                            createGuidedResponse({
                                response:
                                    "You do not have to choose a step yet. What feels unresolved about moving forward?",
                                updates: [
                                    {
                                        key: "readiness",
                                        status: "deferred",
                                        summary: "The user is not ready to plan an action yet."
                                    }
                                ],
                                nextObjective:
                                    "emotionalContext",
                                turnFunctions: [
                                    "READINESS_HESITATION"
                                ]
                            })
                }
            );


        await harness.run(
            'handleGuidedResponse("I am not ready to make a plan.")'
        );


        assert.equal(
            harness.run(
                "state.reflection.objectives.optionsNextSteps.status"
            ),
            "unresolved"
        );
        assert.equal(
            harness.run(
                "state.reflection.activeObjective"
            ),
            "emotionalContext"
        );

    }
);


test(
    "a realistic next step can complete reflection without treating the catalog as a checklist",
    async () => {

        const harness =
            createHarness(
                createValidState(),
                {
                    fetchImplementation:
                        async () =>
                            createGuidedResponse({
                                response:
                                    "Twice a week with resistance bands is a concrete step that fits what you said is realistic.",
                                updates: [
                                    {
                                        key: "goals",
                                        status: "complete",
                                        summary: "Get stronger at home."
                                    },
                                    {
                                        key: "optionsNextSteps",
                                        status: "complete",
                                        summary: "Use resistance bands at home twice a week."
                                    }
                                ],
                                nextObjective:
                                    null,
                                reflectionComplete:
                                    true
                            })
                }
            );


        await harness.run(
            'handleGuidedResponse("I can use my resistance bands twice a week.")'
        );

        harness.flushTimers();


        assert.equal(
            harness.run(
                "state.reflection.activeObjective"
            ),
            null
        );
        assert.equal(
            harness.run(
                "state.reflection.objectives.socialContext.status"
            ),
            "unresolved"
        );
        assert.match(
            renderedText(
                harness.elements.get("helloChat")
            ),
            /Your next step: Use resistance bands at home twice a week\./
        );

    }
);


test(
    "Guided language remains plaintext and does not use synonym rotation",
    async () => {

        const responses = [
            createGuidedResponse({
                response:
                    "Persistence is one strength you have already named. What else has helped?",
                updates: [],
                nextObjective:
                    "strengthsResources"
            }),
            createGuidedResponse({
                response:
                    "A budgeting tool could be a practical resource. Which kind would be easiest to use?",
                updates: [],
                nextObjective:
                    "strengthsResources"
            })
        ];

        const harness =
            createHarness(
                createValidState(),
                {
                    fetchImplementation:
                        async () =>
                            responses.shift()
                }
            );


        await harness.run(
            'handleGuidedResponse("Persistence.")'
        );
        await harness.run(
            'handleGuidedResponse("Maybe a budgeting tool.")'
        );


        const text =
            renderedText(
                harness.elements.get("helloChat")
            );


        assert.doesNotMatch(text, /—/);
        assert.doesNotMatch(
            inlineScript,
            /synonymRotation|rotateSynonym|openerRotation/
        );
        assert.doesNotMatch(
            text,
            /Absolutely|Great question|That makes sense/
        );

    }
);


test(
    "Guided double-send is locked and the request excludes Ask history",
    async () => {

        let resolveFetch;

        const pendingResponse =
            new Promise(
                resolve => {
                    resolveFetch = resolve;
                }
            );

        const harness =
            createHarness(
                createValidState(),
                {
                    fetchImplementation:
                        async () =>
                            pendingResponse
                }
            );


        const first =
            harness.run(
                'handleGuidedResponse("First Guided turn")'
            );

        const second =
            harness.run(
                'handleGuidedResponse("Second turn must be blocked")'
            );


        assert.equal(harness.fetchCalls.length, 1);


        const body =
            JSON.parse(
                harness.fetchCalls[0]
                    .options.body
            );


        assert.equal(
            body.mode,
            "guided-reflection"
        );
        assert.deepEqual(
            body.conversation,
            []
        );
        assert.ok(body.profile.wellnessContext);
        assert.ok(body.reflectionContext);


        resolveFetch(
            createGuidedResponse()
        );

        await first;
        await second;

    }
);


test(
    "late Guided response cannot render or mutate state after a mode switch",
    async () => {

        let resolveFetch;

        const pendingResponse =
            new Promise(
                resolve => {
                    resolveFetch = resolve;
                }
            );

        const harness =
            createHarness(
                createValidState(),
                {
                    fetchImplementation:
                        async () =>
                            pendingResponse
                }
            );


        const pending =
            harness.run(
                'handleGuidedResponse("A pending Guided answer")'
            );

        harness.run(
            'switchMode("ask")'
        );

        resolveFetch(
            createGuidedResponse({
                response:
                    "STALE_GUIDED_RESPONSE"
            })
        );

        await pending;


        const chatText =
            renderedText(
                harness.elements.get("helloChat")
            );


        assert.doesNotMatch(
            chatText,
            /STALE_GUIDED_RESPONSE/
        );
        assert.equal(
            harness.run(
                "state.reflection.objectives.currentSuccesses.status"
            ),
            "unresolved"
        );

    }
);


test(
    "raw Guided transcript is not persisted and restarting clears Guided memory",
    async () => {

        const harness =
            createHarness(
                createValidState(),
                {
                    fetchImplementation:
                        async () =>
                            createGuidedResponse({
                                updates: [
                                    {
                                        key: "barriers",
                                        status: "partial",
                                        summary: "A time barrier was identified."
                                    }
                                ]
                            })
                }
            );

        const rawText =
            "RAW_GUIDED_TRANSCRIPT_TOKEN with personal detail";


        await harness.run(
            `handleGuidedResponse(${JSON.stringify(rawText)})`
        );


        assert.doesNotMatch(
            harness.storage.get(
                "helloWellnessState"
            ),
            /RAW_GUIDED_TRANSCRIPT_TOKEN/
        );
        assert.equal(
            harness.run(
                "guidedConversation.length"
            ),
            2
        );


        harness.run("restartReflection()");


        assert.equal(
            harness.run(
                "guidedConversation.length"
            ),
            0
        );
        assert.equal(
            harness.run(
                "state.reflection.objectives.barriers.status"
            ),
            "unresolved"
        );

    }
);


test(
    "Guided conversation memory is capped and mode switching clears only raw turns",
    () => {

        const harness =
            createHarness(
                createValidState()
            );


        harness.run(`
            ensureReflectionState();
            state.reflection.objectives.goals = {
                status: "complete",
                summary: "Keep this structured goal.",
                updatedAtTurn: 1
            };
            for (let index = 0; index < 12; index++) {
                appendGuidedConversationTurn(
                    index % 2 === 0 ? "user" : "assistant",
                    "turn-" + index
                );
            }
        `);


        assert.equal(
            harness.run(
                "guidedConversation.length"
            ),
            10
        );
        assert.equal(
            harness.run(
                "guidedConversation[0].content"
            ),
            "turn-2"
        );


        harness.run('switchMode("ask")');


        assert.equal(
            harness.run(
                "guidedConversation.length"
            ),
            0
        );
        assert.equal(
            harness.run(
                "state.reflection.objectives.goals.summary"
            ),
            "Keep this structured goal."
        );

    }
);
