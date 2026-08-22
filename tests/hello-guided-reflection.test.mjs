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
            goal: "A test goal",
            actionStep: "A test step",
            confidence: "7"
        },
        ...overrides
    };

}


function createHarness(savedState) {

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
            fetch: async () => {
                throw new Error(
                    "Guided Reflection tests must not call providers."
                );
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
    "Guided response advances through the existing guarded callback",
    () => {

        const harness =
            createHarness(
                createValidState()
            );


        harness.run(
            'handleGuidedResponse("A test answer")'
        );

        harness.flushTimers();


        const chat =
            harness.elements.get("helloChat");


        assert.equal(
            harness.run("state.currentStep"),
            1
        );
        assert.equal(
            countText(
                chat,
                "What would you like to be different?"
            ),
            1
        );

    }
);


test(
    "mode change still cancels a stale Guided callback",
    () => {

        const harness =
            createHarness(
                createValidState()
            );


        harness.run(
            'handleGuidedResponse("A test answer"); switchMode("ask");'
        );

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
                    currentStep: 8
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
