import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  fetchMerchantMultiLangSettings,
  fetchMerchantOverview,
  fetchMerchantSettings,
  updateMerchantMultiLangSettings,
  updateMerchantSettings,
} from "../platform.server";

type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [overview, merchantSettings, multiLang] = await Promise.all([
    fetchMerchantOverview(session.shop),
    fetchMerchantSettings(session.shop),
    fetchMerchantMultiLangSettings(session.shop).catch(() => ({
      settings: {
        shop_id: "",
        default_source_lang: "en",
        enabled_langs: ["en"],
        multi_lang_rag_enabled: false,
      },
    })),
  ]);

  return {
    overview,
    merchant: merchantSettings.merchant,
    multiLang: multiLang.settings,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  try {
    if (intent === "save-persona") {
      await updateMerchantSettings(session.shop, {
        notification_phone: String(formData.get("notification_phone") || "").trim() || null,
        persona_settings: {
          bot_name: String(formData.get("bot_name") || "").trim() || undefined,
          tone:
            (String(formData.get("tone") || "").trim() as
              | "friendly"
              | "professional"
              | "casual"
              | "formal") || "friendly",
          emoji: formData.get("emoji") === "on",
          response_length:
            (String(formData.get("response_length") || "").trim() as
              | "short"
              | "medium"
              | "long") || "medium",
          whatsapp_sender_mode:
            (String(formData.get("whatsapp_sender_mode") || "").trim() as
              | "merchant_own"
              | "corporate") || "merchant_own",
          whatsapp_welcome_template:
            String(formData.get("whatsapp_welcome_template") || "").trim() || undefined,
        },
      });

      return {
        ok: true,
        message: "Merchant settings saved successfully.",
      } satisfies ActionResult;
    }

    if (intent === "save-multilang") {
      const defaultSourceLang = String(formData.get("default_source_lang") || "en").trim() || "en";
      const rawLangs = String(formData.get("enabled_langs") || defaultSourceLang)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const enabledLangs = Array.from(new Set([defaultSourceLang, ...rawLangs]));

      await updateMerchantMultiLangSettings(session.shop, {
        default_source_lang: defaultSourceLang,
        enabled_langs: enabledLangs,
        multi_lang_rag_enabled: formData.get("multi_lang_rag_enabled") === "on",
      });

      return {
        ok: true,
        message: "Multilingual RAG settings saved successfully.",
      } satisfies ActionResult;
    }

    return { ok: false, error: "Unknown action." } satisfies ActionResult;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Settings action failed.",
    } satisfies ActionResult;
  }
};

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  const persona = data.merchant.persona_settings || {};

  return (
    <>
      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h2 className="shellSectionTitle">Settings</h2>
            <p className="shellSectionText">
              Core merchant configuration for bot behavior and WhatsApp routing.
            </p>
          </div>
          <span className="shellStatus shellStatusConnected">
            {data.overview.subscription?.status || "inactive"}
          </span>
        </div>

        {actionData?.message ? (
          <div className="shellAlert shellAlertSuccess">{actionData.message}</div>
        ) : null}
        {actionData?.error ? (
          <div className="shellAlert shellAlertError">{actionData.error}</div>
        ) : null}

        <Form method="post" className="shellFormStack">
          <input type="hidden" name="intent" value="save-persona" />

          <div className="shellSettingsGrid">
            <article className="shellCard">
              <h3 className="shellCardTitle">Bot profile</h3>
              <div className="shellFormGrid">
                <label className="shellField">
                  <span>Bot name</span>
                  <input
                    className="shellInput"
                    type="text"
                    name="bot_name"
                    defaultValue={persona.bot_name || ""}
                    disabled={busy}
                  />
                </label>

                <label className="shellField">
                  <span>Tone</span>
                  <select
                    className="shellInput"
                    name="tone"
                    defaultValue={persona.tone || "friendly"}
                    disabled={busy}
                  >
                    <option value="friendly">Friendly</option>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                  </select>
                </label>

                <label className="shellField">
                  <span>Response length</span>
                  <select
                    className="shellInput"
                    name="response_length"
                    defaultValue={persona.response_length || "medium"}
                    disabled={busy}
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </label>

                <label className="shellField">
                  <span>Sender mode</span>
                  <select
                    className="shellInput"
                    name="whatsapp_sender_mode"
                    defaultValue={persona.whatsapp_sender_mode || "merchant_own"}
                    disabled={busy}
                  >
                    <option value="merchant_own">Merchant own number</option>
                    <option value="corporate">Corporate number</option>
                  </select>
                </label>
              </div>

              <label className="shellToggle">
                <input
                  type="checkbox"
                  name="emoji"
                  defaultChecked={persona.emoji !== false}
                  disabled={busy}
                />
                <span>Allow emoji in responses</span>
              </label>
            </article>

            <article className="shellCard">
              <h3 className="shellCardTitle">Notifications and template</h3>
              <div className="shellFormGrid">
                <label className="shellField shellFieldFull">
                  <span>Notification phone</span>
                  <input
                    className="shellInput"
                    type="tel"
                    name="notification_phone"
                    defaultValue={data.merchant.notification_phone || ""}
                    placeholder="+90 5xx xxx xx xx"
                    disabled={busy}
                  />
                </label>

                <label className="shellField shellFieldFull">
                  <span>Welcome template</span>
                  <textarea
                    className="shellInput shellTextarea"
                    name="whatsapp_welcome_template"
                    rows={7}
                    defaultValue={persona.whatsapp_welcome_template || ""}
                    disabled={busy}
                  />
                </label>
              </div>
            </article>
          </div>

          <div className="shellFormActions">
            <button className="shellButton shellButtonPrimary shellButtonAsButton" type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save merchant settings"}
            </button>
          </div>
        </Form>
      </section>

      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h3 className="shellSectionTitle">Multilingual RAG</h3>
            <p className="shellSectionText">
              Configure the source language and enabled languages for multilingual retrieval.
            </p>
          </div>
        </div>

        <Form method="post" className="shellFormStack">
          <input type="hidden" name="intent" value="save-multilang" />

          <div className="shellSettingsGrid">
            <article className="shellCard">
              <div className="shellFormGrid">
                <label className="shellField">
                  <span>Default source language</span>
                  <select
                    className="shellInput"
                    name="default_source_lang"
                    defaultValue={data.multiLang.default_source_lang || "en"}
                    disabled={busy}
                  >
                    <option value="en">English</option>
                    <option value="tr">Turkish</option>
                    <option value="hu">Hungarian</option>
                    <option value="de">German</option>
                    <option value="el">Greek</option>
                  </select>
                </label>

                <label className="shellField shellFieldFull">
                  <span>Enabled languages</span>
                  <input
                    className="shellInput"
                    type="text"
                    name="enabled_langs"
                    defaultValue={(data.multiLang.enabled_langs || []).join(", ")}
                    placeholder="en, tr, de"
                    disabled={busy}
                  />
                </label>
              </div>

              <label className="shellToggle">
                <input
                  type="checkbox"
                  name="multi_lang_rag_enabled"
                  defaultChecked={Boolean(data.multiLang.multi_lang_rag_enabled)}
                  disabled={busy}
                />
                <span>Enable multilingual RAG</span>
              </label>
            </article>

            <article className="shellCard">
              <h4 className="shellCardTitle">Current state</h4>
              <div className="shellDefinitionList">
                <div className="shellDefinitionRow">
                  <span>Default language</span>
                  <strong>{data.multiLang.default_source_lang || "en"}</strong>
                </div>
                <div className="shellDefinitionRow">
                  <span>Enabled languages</span>
                  <strong>{(data.multiLang.enabled_langs || []).join(", ") || "en"}</strong>
                </div>
                <div className="shellDefinitionRow">
                  <span>Status</span>
                  <strong>
                    {data.multiLang.multi_lang_rag_enabled ? "Enabled" : "Disabled"}
                  </strong>
                </div>
              </div>
            </article>
          </div>

          <div className="shellFormActions">
            <button className="shellButton shellButtonPrimary shellButtonAsButton" type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save multilingual settings"}
            </button>
          </div>
        </Form>
      </section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
