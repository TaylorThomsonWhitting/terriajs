import i18next from "i18next";
import defaultValue from "terriajs-cesium/Source/Core/defaultValue";
import { isJsonObject, JsonObject } from "../Core/Json";
import loadJson from "../Core/loadJson";
import loadWithXhr from "../Core/loadWithXhr";
import TerriaError from "../Core/TerriaError";
import Terria from "./Terria";

interface ShareDataServiceOptions {
  terria: Terria;
  url?: string;
}

/**
 * Interface to the terriajs-server service for creating short share links.
 * @param {*} options
 *
 * @alias ShareDataService
 * @constructor
 */
export default class ShareDataService {
  readonly terria: Terria;
  url: string | undefined;
  private _serverConfig: any;

  constructor(options: ShareDataServiceOptions) {
    this.terria = options.terria;
    this.url = options.url;
  }

  init(serverConfig: any) {
    this.url = defaultValue(
      this.url,
      defaultValue(this.terria.configParameters.shareUrl, "share")
    );

    this._serverConfig = serverConfig;
  }

  get isUsable(): boolean {
    return true;
    // return (
    //   (this.url !== undefined &&
    //     typeof this._serverConfig === "object" &&
    //     typeof this._serverConfig.newShareUrlPrefix === "string") ||
    //   this.url !== "share"
    // );
  }

  /**
   * Allocates a share token using Terria Server, storing the provided data there.
   * @param shareData JSON to store.
   * @return A promise for the token (which can later be resolved at /share/TOKEN).
   */
  // async getShareToken(shareData: any): Promise<string> {
  //   if (!this.isUsable) {
  //     throw TerriaError.from("`ShareDataService` is not usable");
  //   }

  //   try {
  //     const result = await loadWithXhr({
  //       url: this.url,
  //       method: "POST",
  //       data: JSON.stringify(shareData),
  //       headers: { "Content-Type": "application/json" },
  //       responseType: "json"
  //     });
  //     const json = typeof result === "string" ? JSON.parse(result) : result;
  //     return json.id;
  //   } catch (error) {
  //     throw TerriaError.from(error, {
  //       title: i18next.t("models.shareData.generateErrorTitle"),
  //       message: i18next.t("models.shareData.generateErrorMessage"),
  //       importance: 1
  //     });
  //   }
  // }

  async getShareToken(shareData: any): Promise<string> {
      if (!this.isUsable) {
        throw TerriaError.from("`ShareDataService` is not usable");
      }
      const functionDomain = 'http://localhost:7071';
      // const functionDomain = 'https://ttwstoragefunctions.azurewebsites.net';

      const blobName = crypto.randomUUID()

      try {
        const getWriteSasResponse = await fetch(
          `${functionDomain}/api/DigitalTwinsShareStorage?container=default&permission=write&blob=${blobName}`, {
          method: 'GET',
          mode: 'cors'
        });

        if (getWriteSasResponse.status >= 300)
          throw new Error('Could not get SAS with write permissions.');

        const writeSas = await getWriteSasResponse.text();

        const putShareDataResponse = await fetch(
          writeSas, {
            method: 'PUT',
            mode: 'cors',
            headers: {
              'x-ms-blob-type': 'BlockBlob'
            },
            body: JSON.stringify(shareData)
          }
        );

        if (putShareDataResponse.status >= 300)
          throw new Error('Could not write to the container.');

        const lifetime = 43200; // 30 days in minutes
        const getReadSasResponse = await fetch(
          `${functionDomain}/api/DigitalTwinsShareStorage?container=default&blob=${blobName}&lifetime=${lifetime}`, {
          method: 'GET',
          mode: 'cors'
        });

        if (getReadSasResponse.status >= 300)
          throw new Error('Could not get SAS with write permissions.');

        return getReadSasResponse.text();
      } catch (error) {
        throw TerriaError.from(error, {
          title: i18next.t("models.shareData.generateErrorTitle"),
          message:i18next.t("models.shareData.generateErrorMessage"),
          importance: 1
        });
      }
  }

  async resolveData(token: string): Promise<JsonObject> {
    if (!this.isUsable) {
      throw TerriaError.from("`ShareDataService` is not usable");
    }

    try {
      // const shareJson = await loadJson(this.url + "/" + token);
      const shareJson = await loadJson(token);

      if (!isJsonObject(shareJson, false)) {
        throw TerriaError.from(
          `Invalid server response for share ${
            this.url + "/" + token
          }\n\`${JSON.stringify(shareJson)}\``
        );
      }


      return shareJson;
    } catch (error) {
      throw TerriaError.from(error, {
        title: i18next.t("models.shareData.expandErrorTitle"),
        message: i18next.t("models.shareData.expandErrorMessage", {
          appName: this.terria.appName
        }),
        importance: 1
      });
    }
  }
}
