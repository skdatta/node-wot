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
 * CoAP Server based on coap by mcollina
 */

import * as url from "url";
import { ContentSerdes, Content} from "@node-wot/core";
import { ProtocolServer, ResourceListener, PropertyResourceListener, ActionResourceListener } from "@node-wot/core"

const dcl = require("iotcs-csl-js");

export default class OracleServer implements ProtocolServer {

  public readonly scheme: string = "oracle";
  public readonly activationId: string;
  private readonly port: number = -1;
  private readonly address: string = undefined;
  private server: any = undefined;
  private running: boolean = false;
  private failed: boolean = false;

  private readonly resources: { [key: string]: ResourceListener } = {};


  // TODO remove and use hook for application script (e.g., Thing metadata)
  //private readonly hardcodedUrn: string = "urn:test:w3c-wot:testthing";
  private readonly hardcodedUrn: string = "urn:dev:wot:siemens:festolive";
  // TODO allow for dynamic Things whose device model is not registered yet (use case for .expose() function)
  private device: any;
  // TODO do not duplicate Interaction state down here -- client library design conflict
  private readonly properties: Map<string, any> = new Map<string, any>();
  private readonly actions: Map<string, any> = new Map<string, any>();

  constructor(store: string = "W3CWOT-0002", password: string = "TestThing1") {
    this.activationId = store;
    this.server = new dcl.device.GatewayDevice(store, password);
  }

  public addResource(path: string, res: ResourceListener): boolean {
    if (this.resources[path] !== undefined) {
      console.warn(`OracleServer ${this.activationId} already has ResourceListener '${path}' - skipping`);
      return false;
    } else {

      // TODO debug-level
      console.log(`OracleServer ${this.activationId} adding resource '${path}'`);
      
      if (res instanceof PropertyResourceListener) {
        console.warn(`### OracleServer ${this.activationId} knows about Property ${res.name}`);

        // .name does not exist on ResourceListener, hence here
        this.resources[res.name] = res;

      } else if (res instanceof ActionResourceListener) {
        console.warn(`### OracleServer ${this.activationId} knows about Action ${res.name}`);

        // .name does not exist on ResourceListener, hence here
        this.resources[res.name] = res;
      }

      /* TODO: Events -- still need the wiring from .emitEvent() down to the ProtocolServers
      // TODO: dynamically register Event URNs based on dynamic Device Models
      if (properties.int > 90) {
          console.log("ALERT: " + properties.int + " higher than 90");
          var alert = this.thing.createAlert('urn:test:w3c-wot:testthing:alert-event');
          alert.fields.cause = "Integer greater than 90";
          alert.raise();
        }
      */

      return true;
    }
  }

  public removeResource(path: string): boolean {
    // TODO debug-level
    console.log(`OracleServer ${this.activationId} removing resource '${path}'`);
    return delete this.resources[path];
  }

  public start(): Promise<void> {
    console.info(`OracleServer starting with ${this.activationId}`);
    return new Promise<void>( (resolve, reject) => {

      if (this.server.isActivated()) {

        // first resource added, lets set up the virtual device
        // TODO create hook, so that Thing name and modelUrn form metadata can be received
        this.getModel(this.hardcodedUrn).then( model => {
          this.registerDevice(model).then( id => {
            this.startDevice(id, model).then( () => {
              resolve();
            });
          });
        }).catch( err => {
          console.error("OracleServer getModel: " + err);
        });
        
      } else {
        
        this.server.activate([], (device: any, error: Error) => {
          if (error) {
            console.log('-----------------ERROR ON ACTIVATION------------------------');
            console.log(error.message);
            console.log('------------------------------------------------------------');
            reject(error);
          }

          this.server = device;
          
          if (this.server.isActivated()) {
            console.debug(`OracleServer activated as ${this.activationId}`);
            resolve();
          } else {
            reject(new Error(`Could not activate`));
          }
        });
      }
    });
  }

  public stop(): Promise<void> {
    console.info(`OracleServer ${this.activationId} stopping`);
    return new Promise<void>((resolve, reject) => {
      // stop promise handles all errors from now on
      try {
        this.server.close();
        resolve();  
      } catch(err) {
        reject();
      }
    });
  }

  public getPort(): number {
    // do not show in TD
    return -1;
  }

  /** fetches the device model by URN */
  private getModel(modelUrn: string): Promise<any> {
    console.debug(`OracleServer ${this.activationId} getting model '${modelUrn}'`);
    return new Promise<void>( (resolve, reject) => {
      if (!this.server.isActivated()) {
        reject(new Error("OracleServer not activated"));
      }
      this.server.getDeviceModel(modelUrn, (model: any, error: Error) => {
        if (error) {
            console.log('-----------------ERROR GETTING DEVICE MODEL-----------------');
            console.log(error.message);
            console.log('------------------------------------------------------------');
            reject(error);
        }
        console.log('-------------------FOUND DEVICE MODEL-----------------------');
        console.log(JSON.stringify(model,null,4));
        console.log('------------------------------------------------------------');
        resolve(model);
      });
    });
  }
  
  /** enrolls device and returns id */
  private registerDevice(model: any): Promise<any> {
    // device allowed to realm
    var hardwareId = `${this.activationId}-${model["name"]}`;

    console.log(`OracleServer ${this.activationId} enrolling '${hardwareId}'`);

    return new Promise<void>( (resolve, reject) => {
      if (!this.server.isActivated()) {
        reject(new Error("OracleServer not activated"));
      }
    
      this.server.registerDevice(
        hardwareId,
        {
          description: "node-wot connected device",
          manufacturer: "Thingweb"
        },
        [model.urn],
        function (id: any, error: Error) {
          if (error) {
              console.log('----------------ERROR ON DEVICE REGISTRATION----------------');
              console.log(error.message);
              console.log('------------------------------------------------------------');
              reject(error);
          }
          if (id) {
              console.log('------------------REGISTERED DEVICE-------------------');
              console.log(id);
              console.log('------------------------------------------------------');
              
              // next
              resolve(id);
          }
        }
      );
    });
  }

  private startDevice(id: any, model: any): Promise<void> {

    this.device = this.server.createVirtualDevice(id, model);

    return new Promise<void>( (resolve, reject) => {

      // "read" is there is only update push in iotcs
      var send = async () => {

        try {
          let attributes: any = {};

          // send all Thing-defined Properties, even if not in Device Model
          for (let resName in this.resources) {
            if (this.resources[resName] instanceof PropertyResourceListener) {
              let content = await this.resources[resName].onRead();
              // FIXME: csl is not a low-level server and does not expect bytes
              attributes[resName] = ContentSerdes.get().contentToValue(content);
            }
          }

          console.warn("### Oracle PROPERTY UPDATE");
          console.dir(attributes);

          this.device.update(attributes);
        } catch(err) {
          console.error("OracleServer onRead error: " + err);
        }
      };
      // every 10 seconds...
      setInterval(send, 10000);

      // attribute writes
      this.device.onChange = (tupples: any) => {
        tupples.forEach( (tupple: any) => {
          if (this.resources[tupple.attribute.id] instanceof PropertyResourceListener) {
            console.warn(`### Thing has Property '${tupple.attribute.id}' for writing '${tupple.newValue}'`);
            this.resources[tupple.attribute.id].onWrite({ mediaType: "application/json", body: tupple.newValue })
              .catch(err => { console.error("Property write error: " + err) });
          }
        });
      };

      // actions
      // only wire Actions defined in Device Model
      for (let action of model.actions) {
        console.warn(`### Oracle Device Model has action '${action.name}' / '${action.alias}'`);
          this.device[action.alias].onExecute = (param: any) => {
            if (this.resources[action.alias] instanceof ActionResourceListener) {
              console.warn(`### Thing has Action '${action.alias}'`);
              this.resources[action.alias].onInvoke({ mediaType: "application/json", body: param })
                .catch(err => { console.error("Action invoke error: " + err) });
              // No action results supported by Oracle
            }
        }
      }

      // FIXME: unclear how errors work -- why do they have attribute values?
      this.device.onError = (tupple: any) => {
        var show = {
            newValues: tupple.newValues,
            tryValues: tupple.tryValues,
            errorResponse: tupple.errorResponse
        };
        console.log('------------------ON DEVICE ERROR ----------------------');
        console.log(JSON.stringify(show,null,4));
        console.log('--------------------------------------------------------');
      };

      resolve();

    });
  }
}
