import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchMerchantOverview } from "../platform.server";

function labelize(value?: string | boolean | null) {
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (!value) return "Not set";
  return value.replace(/_/g, " ");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return fetchMerchantOverview(session.shop);
};

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>();
  const persona = data.settings.personaSettings || {};

  return (
    <>
      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h2 className="shellSectionTitle">Settings</h2>
            <p className="shellSectionText">
              Merchant configuration currently visible to the retention engine.
            </p>
          </div>
        </div>

        <div className="shellSettingsGrid">
          <article className="shellCard">
            <h3 className="shellCardTitle">Bot profile</h3>
            <div className="shellDefinitionList">
              <div className="shellDefinitionRow">
                <span>Bot name</span>
                <strong>{labelize(persona.bot_name)}</strong>
              </div>
              <div className="shellDefinitionRow">
                <span>Tone</span>
                <strong>{labelize(persona.tone)}</strong>
              </div>
              <div className="shellDefinitionRow">
                <span>Response length</span>
                <strong>{labelize(persona.response_length)}</strong>
              </div>
              <div className="shellDefinitionRow">
                <span>Emoji</span>
                <strong>{labelize(persona.emoji)}</strong>
              </div>
            </div>
          </article>

          <article className="shellCard">
            <h3 className="shellCardTitle">WhatsApp routing</h3>
            <div className="shellDefinitionList">
              <div className="shellDefinitionRow">
                <span>Sender mode</span>
                <strong>{labelize(persona.whatsapp_sender_mode)}</strong>
              </div>
              <div className="shellDefinitionRow">
                <span>Notification phone</span>
                <strong>{labelize(data.settings.notificationPhone)}</strong>
              </div>
            </div>
            <p className="shellMutedBlock">
              Full editing can stay in the classic portal until the shell takes
              over merchant settings completely.
            </p>
          </article>
        </div>
      </section>

      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h3 className="shellSectionTitle">Welcome template</h3>
            <p className="shellSectionText">
              Current merchant-authored template used by the messaging system.
            </p>
          </div>
        </div>

        <article className="shellTemplateCard">
          {persona.whatsapp_welcome_template ? (
            <p>{persona.whatsapp_welcome_template}</p>
          ) : (
            <p className="shellSectionText">
              No custom template is stored yet.
            </p>
          )}
        </article>
      </section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
