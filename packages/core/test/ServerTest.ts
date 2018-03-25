/*
 * W3C Software License
 *
 * Copyright (c) 2018 the thingweb community
 *
 * THIS WORK IS PROVIDED "AS IS," AND COPYRIGHT HOLDERS MAKE NO REPRESENTATIONS OR
 * WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO, WARRANTIES OF
 * MERCHANTABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE
 * SOFTWARE OR DOCUMENT WILL NOT INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS,
 * TRADEMARKS OR OTHER RIGHTS.
 *
 * COPYRIGHT HOLDERS WILL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, SPECIAL OR
 * CONSEQUENTIAL DAMAGES ARISING OUT OF ANY USE OF THE SOFTWARE OR DOCUMENT.
 *
 * The name and trademarks of copyright holders may NOT be used in advertising or
 * publicity pertaining to the work without specific, written prior permission. Title
 * to copyright in this work will at all times remain with copyright holders.
 */

/**
 * Basic test suite to demonstrate test setup
 * uncomment the @skip to see failing tests
 * 
 * h0ru5: there is currently some problem with VSC failing to recognize experimentalDecorators option, it is present in both tsconfigs
 */

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should } from "chai";
// should must be called to augment all variables
should();

import Servient from "../src/servient";
import * as listeners from "../src/resource-listeners/all-resource-listeners";
import { ProtocolServer, Content, ResourceListener } from "../src/resource-listeners/protocol-interfaces"
import ExposedThing from "../src/exposed-thing";

// implement a testserver to mock a server
class TestProtocolServer implements ProtocolServer {

    public readonly scheme: string = "test";
    private listeners: Map<string, ResourceListener> = new Map();

    getListenerFor(path: string): ResourceListener {
        return this.listeners.get(path);
    }

    addResource(path: string, res: ResourceListener): boolean {
        if (this.listeners.has(path)) return false;
        this.listeners.set(path, res);
    }

    removeResource(path: string): boolean {
        return true;
    }

    start(): Promise<void> { return new Promise<void>((resolve, reject) => { resolve(); }); }
    stop(): Promise<void> { return new Promise<void>((resolve, reject) => { resolve(); }); }
    getPort(): number { return -1 }
}

@suite("the server side of servient")
class WoTServerTest {

    static servient: Servient;
    static WoT: WoT.WoTFactory;
    static server: TestProtocolServer;

    static before() {
        this.servient = new Servient();
        this.server = new TestProtocolServer();
        this.servient.addServer(this.server);
        this.servient.start().then(WoTruntime => { this.WoT = WoTruntime; });
        console.log("before starting test suite");
    }

    static after() {
        console.log("after finishing test suite");
        this.servient.shutdown();
    }

    @test "should be able to add a Thing given a template"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({
            name: "myThing"
        });
        expect(thing).to.exist;
        expect(JSON.parse(thing.getThingDescription()).name).equal("myThing");
        expect(thing).to.have.property("name", "myThing");
    }


    @test "should be able to add a Thing given a TD"() {
        let desc = `{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
            "@type": ["Thing"],
            "name": "myThingX",
            "interaction": [
                {
                    "@type": ["Property"],
                    "name": "myPropX"
                }
            ]
        }`;

        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce(desc);
        expect(thing).to.exist;
        expect(thing).to.have.property("name", "myThingX");
        expect(thing).to.have.property("interaction");
    }

    @test async "should be able to add a property with default value 0"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing100" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`,
            value: 0
        };
        thing.addProperty(initp);
        let value1 = await thing.readProperty("number");
        expect(value1).to.equal(0);
    }


    @test async "should be able to add a property with default value XYZ"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing101" });
        let initp: WoT.ThingProperty = {
            name: "string",
            writable: true,
            schema: `{ "type": "string" }`,
            value: "XYZ"
        };
        thing.addProperty(initp);
        let value1 = await thing.readProperty("string");
        expect(value1).to.equal("XYZ");
    }

    @test async "should be able to add a property without any default value"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing102" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        thing.addProperty(initp);
        let value1 = await thing.readProperty("number");
        expect(value1).to.equal(null);
    }

    @test async "should be able to add a property, read it and write it locally"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`,
            value: 10
        };
        thing.addProperty(initp);
        let value0 = await thing.readProperty("number");
        expect(value0).to.equal(10);
        let value1 = await thing.writeProperty("number", 5);
        expect(value1).to.equal(5);
        let value2 = await thing.readProperty("number");
        expect(value2).to.equal(5);
    }


    @test async "should be able to add a property, read it by setting read increment handler"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingIncRead" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        let counter: number = 0;
        thing.addProperty(initp).setPropertyReadHandler(
            initp.name,
            () => {
                return new Promise((resolve, reject) => {
                    resolve(++counter);
                });
            }
        );

        expect(await thing.readProperty("number")).to.equal(1);
        expect(await thing.readProperty("number")).to.equal(2);
        expect(await thing.readProperty("number")).to.equal(3);
    }

    @test async "should be able to add a property, read it by setting read increment handler (with function)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingIncRead2" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        let counter: number = 0;
        thing.addProperty(initp).setPropertyReadHandler(
            initp.name,
            function() {
                return new Promise((resolve, reject) => {
                    resolve(++counter);
                });
            }
        );

        expect(await thing.readProperty("number")).to.equal(1);
        expect(await thing.readProperty("number")).to.equal(2);
        expect(await thing.readProperty("number")).to.equal(3);
    }


    @test async "should be able to add a property, read it by setting read increment handler (with local counter state)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingIncRead3" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        thing.addProperty(initp).setPropertyReadHandler(
            initp.name,
            function() {
                return new Promise((resolve, reject) => {
                    // TODO: figure out a way to provide a common scope that can be used for consecutive handler calls
                    // let counter: number = 0; // fails to keep state!!
                    // var counter: number = 0; // fails to keep state also!!
                    // resolve(++counter);
                    if (!this.counter) {
                        // init counter the first time
                        this.counter = 0;
                    }
                    resolve(++this.counter);
                });
            }
        );

        expect(await thing.readProperty("number")).to.equal(1);
        expect(await thing.readProperty("number")).to.equal(2);
        expect(await thing.readProperty("number")).to.equal(3);
    }

    @test async "should be able to add a property, read it by setting write handler double"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingWrite" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        thing.addProperty(initp);
        let initp2: WoT.ThingProperty = {
            name: "number2",
            writable: true,
            schema: `{ "type": "number" }`
        };
        thing.addProperty(initp2);
        thing.setPropertyWriteHandler(
            initp.name,
            (value: any) => {
                return new Promise((resolve, reject) => {
                    thing.writeProperty(initp2.name, value*2);
                    resolve(value);
                });
            }
        );

        expect(await thing.writeProperty("number", 12)).to.equal(12);
        expect(await thing.readProperty("number2")).to.equal(24);

        thing.setPropertyWriteHandler(
            initp.name,
            function(value: any) {
                return new Promise((resolve, reject) => {
                    thing.writeProperty(initp2.name, value*2);
                    resolve(value);
                });
            }
        );

        expect(await thing.writeProperty("number", 13)).to.equal(13);
        expect(await thing.readProperty("number2")).to.equal(26);
    }

    @test async "should be able to add a property, read it by setting write handler with reading old value"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingReadWrite" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`,
            value : 2
        };
        thing.addProperty(initp);
        // set handler that writes newValue as oldValue+request
        thing.setPropertyWriteHandler(
            initp.name,
            (value: any) => {
                return new Promise((resolve, reject) => {
                    thing.readProperty(initp.name).then(
                         (oldValue) => {
                            resolve(oldValue + value);
                         }
                    );
                });
            }
        );

        expect(await thing.writeProperty("number", 1)).to.equal(3); // 2 + 1 = 3
        expect(await thing.readProperty("number")).to.equal(3);

        expect(await thing.writeProperty("number", 2)).to.equal(5); // 3 + 2 = 5
        expect(await thing.readProperty("number")).to.equal(5);
    }


    // FIXME What listeners?!
    @test.skip "should be able to add a property, assign it via listener and read it locally"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "thing3" });
        let initp: WoT.ThingProperty = {
            name: "prop1",
            writable: true,
            schema: `{ "type": "number" }`,
            value: 10
        };
        thing.addProperty(initp);

        let listener = WoTServerTest.server.getListenerFor("/thing3/properties/prop1");
        expect(listener).to.exist;
        listener.should.be.an.instanceOf(listeners.PropertyResourceListener);
        return listener.onWrite({ mediaType: undefined, body: new Buffer("5") }).then(() => {
            return thing.readProperty("prop1").then((value) => expect(value).to.equal(5));
        });
    }

    // FIXME What listeners?!
    @test.skip "should be able to add a property, assign it locally and read it via listener"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "thing4" });
        let initp: WoT.ThingProperty = {
            name: "prop1",
            writable: true,
            schema: `{ "type": "number" }`,
            value: 10
        };
        thing.addProperty(initp);

        let listener = WoTServerTest.server.getListenerFor("/thing4/properties/prop1");
        expect(listener).to.exist;
        listener.should.be.an.instanceOf(listeners.PropertyResourceListener);

        return thing.writeProperty("prop1", 23).then((value) => {
            return listener.onRead().then((content) => {
                content.should.deep.equal({ mediaType: "application/json", body: new Buffer("23") });
            });
        });
    }

    // FIXME What listeners?!
    @test.skip "should be able to add a property, assign and read it via listener"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({
            name: "thing5"
        });
        let initp: WoT.ThingProperty = {
            name: "prop1",
            writable: true,
            schema: `{ "type": "number" }`,
            value: 10
        };
        thing.addProperty(initp);

        let listener = WoTServerTest.server.getListenerFor("/thing5/properties/prop1");
        expect(listener).to.exist;
        listener.should.be.an.instanceOf(listeners.PropertyResourceListener);
        return listener.onWrite({ mediaType: undefined, body: new Buffer("42") }).then(() => {
            return thing.readProperty("prop1").then((value) => {
                value.should.equal(42);
                return listener.onRead().then((content) => {
                    content.body.should.deep.equal(new Buffer("42"));
                });
            });
        });
    }

    @test "should be able to add an action and invoke it locally"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({
            name: "thing6"
        });
        let inita: WoT.ThingAction = {
            name: "action1",
            inputSchema: `{ "type": "number" }`,
            outputSchema: JSON.stringify({ "type": "number" })
        };
        thing.addAction(inita).setActionHandler(
            inita.name,
            (parameters: any) => {
                return new Promise((resolve, reject) => {
                    parameters.should.be.a("number");
                    parameters.should.equal(23);
                    resolve(42);
                });
            }
        );

        return thing.invokeAction("action1", 23).then((result) => result.should.equal(42));
    }

    // FIXME ThingTemplate does not process given Interactions yet
    @test.skip "should be able to add an action and invoke it locally (based on WoT.ThingTemplate)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({
            name: "thing6b"
        });
        let inita: WoT.ThingAction = {
            name: "action1",
            inputSchema: `{ "type": "number" }`,
            outputSchema: `{ "type": "number" }`
        };

        thing.addAction(inita).setActionHandler(
            inita.name,
            (parameters: any) => {
                return new Promise((resolve, reject) => {
                    parameters.should.be.a("number");
                    parameters.should.equal(23);
                    resolve(42);
                });
            }
        );

        return thing.invokeAction("action1", 23).then((result) => result.should.equal(42));
    }

    @test "should be able to add an action and invoke it locally (based on WoT.ThingDescription)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce(`{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
            "@type": ["Thing"],
            "name": "thing6b",
            "interaction": [
                {
                    "@type": ["Action"],
                    "name": "action1",
                    "inputSchema": { "type": "number" },
                    "outputSchema": { "type": "number" }
                }
            ]
        }`);
        expect(thing).to.have.property("interaction");

        thing.setActionHandler(
            "action1",
            (parameters: any) => {
                return new Promise((resolve, reject) => {
                    parameters.should.be.a("number");
                    parameters.should.equal(23);
                    resolve(42);
                });
            }
        );

        return thing.invokeAction("action1", 23).then((result) => result.should.equal(42));
    }

    // FIXME What listeners?!
    @test.skip "should be able to add an action and invoke it via listener"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({
            name: "thing7"
        });
        let inita: WoT.ThingAction = {
            name: "action1",
            inputSchema: `{ "type": "number" }`,
            outputSchema: `{ "type": "number" }`
        };
        thing.addAction(inita).setActionHandler(
            inita.name,
            (parameters: any) => {
                return new Promise((resolve, reject) => {
                    parameters.should.be.a("number");
                    parameters.should.equal(23);
                    resolve(42);
                });
            }
        );

        let listener = WoTServerTest.server.getListenerFor("/thing7/actions/action1");
        expect(listener).to.exist;
        listener.should.be.an.instanceOf(listeners.ActionResourceListener);

        return listener
            .onInvoke({ mediaType: undefined, body: new Buffer("23") })
            .then((resBytes => {
                resBytes.should.deep.equal({ mediaType: "application/json", body: new Buffer("42") });
            }));
    }
}
