import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import PermissionEdit from '@app/components/PermissionEdit';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { TrashIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';

interface OidcGroupMapping {
  oidcGroup: string;
  permissions: number;
}

interface OidcSettingsResponse {
  issuerUrl: string;
  useDiscovery: boolean;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  displayName: string;
  groupsClaim: string;
  nameClaim: string;
  emailClaim: string;
  groupMappings: OidcGroupMapping[];
  claimsToSync: string[];
  scopes: string[];
}

const messages = defineMessages('components.Settings.SettingsOidc', {
  toastSettingsSuccess: 'OIDC settings saved successfully.',
  toastSettingsFailure: 'Something went wrong while saving OIDC settings.',
  oidcSettings: 'OIDC / Single Sign-On',
  oidcSettingsDescription:
    'Configure an OpenID Connect provider for single sign-on.',
  useDiscovery: 'Use OIDC discovery',
  useDiscoveryTip:
    'When enabled, endpoints are read from Issuer URL/.well-known/openid-configuration. When disabled, enter endpoints manually.',
  issuerUrl: 'Issuer URL',
  issuerUrlTip: 'Base URL of the OIDC provider (e.g. https://idp.example.com)',
  authorizationUrl: 'Authorization URL',
  authorizationUrlTip: 'OAuth2 authorization endpoint (manual mode)',
  tokenUrl: 'Token URL',
  tokenUrlTip: 'OAuth2 token endpoint (manual mode)',
  userInfoUrl: 'User info URL',
  userInfoUrlTip: 'Optional userinfo endpoint (manual mode)',
  issuer: 'Issuer',
  issuerTip: 'Issuer value for token validation (manual mode)',
  clientId: 'Client ID',
  clientIdTip: 'OAuth2 client ID from your IdP',
  clientSecret: 'Client Secret',
  clientSecretTip: 'OAuth2 client secret from your IdP',
  displayName: 'Display Name',
  displayNameTip: 'Label shown on the login button (e.g. SSO or Company IdP)',
  claimsSection: 'Claim names',
  groupsClaim: 'Groups claim',
  groupsClaimTip:
    'ID token claim containing group names (e.g. groups, memberOf, roles)',
  nameClaim: 'Name claim',
  nameClaimTip:
    'ID token claim for display name (e.g. name, preferred_username)',
  emailClaim: 'Email claim',
  emailClaimTip: 'ID token claim for email address',
  groupMappingsSection: 'Group mappings',
  groupMappingsTip:
    'Map OIDC group names to Seerr permissions. User gets the combined permissions of all matching groups.',
  oidcGroup: 'OIDC group name',
  permissions: 'Seerr permissions',
  addMapping: 'Add mapping',
  claimsToSync: 'Claims to sync',
  claimsToSyncTip:
    'Additional claim names to read from the ID token and store on the user (one per line, e.g. department, roles).',
  scopes: 'OAuth scopes',
  scopesTip:
    'Scopes to request from the provider (one per line, e.g. openid, profile, email).',
  permissionDenied: 'You do not have permission to view OIDC settings.',
});

const oidcSettingsFetcher = async (
  url: string
): Promise<OidcSettingsResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(res.statusText) as Error & {
      response?: { status: number };
    };
    err.response = { status: res.status };
    throw err;
  }
  return res.json();
};

const SettingsOidc = () => {
  const { addToast } = useToasts();
  const intl = useIntl();
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<OidcSettingsResponse>(
    '/api/v1/settings/oidc',
    oidcSettingsFetcher
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (error) {
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    const message =
      status === 403 || status === 404
        ? intl.formatMessage(messages.permissionDenied)
        : intl.formatMessage(messages.toastSettingsFailure);
    return (
      <>
        <PageTitle
          title={[
            intl.formatMessage(messages.oidcSettings),
            intl.formatMessage(globalMessages.settings),
          ]}
        />
        <div className="mb-6">
          <h3 className="heading">
            {intl.formatMessage(messages.oidcSettings)}
          </h3>
          <p className="description text-red-500">{message}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.oidcSettings),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.oidcSettings)}</h3>
        <p className="description">
          {intl.formatMessage(messages.oidcSettingsDescription)}
        </p>
      </div>
      <div className="section">
        <Formik
          initialValues={{
            issuerUrl: data?.issuerUrl ?? '',
            useDiscovery: data?.useDiscovery ?? true,
            authorizationUrl: data?.authorizationUrl ?? '',
            tokenUrl: data?.tokenUrl ?? '',
            userInfoUrl: data?.userInfoUrl ?? '',
            issuer: data?.issuer ?? '',
            clientId: data?.clientId ?? '',
            clientSecret:
              data?.clientSecret === '********'
                ? ''
                : (data?.clientSecret ?? ''),
            displayName: data?.displayName ?? 'SSO',
            groupsClaim: data?.groupsClaim ?? 'groups',
            nameClaim: data?.nameClaim ?? 'name',
            emailClaim: data?.emailClaim ?? 'email',
            groupMappings: Array.isArray(data?.groupMappings)
              ? data.groupMappings.map((m) => ({
                  oidcGroup: m.oidcGroup ?? '',
                  permissions: m.permissions ?? 0,
                }))
              : [],
            claimsToSync: Array.isArray(data?.claimsToSync)
              ? data.claimsToSync.join('\n')
              : '',
            scopes: Array.isArray(data?.scopes)
              ? data.scopes.join('\n')
              : 'openid\nprofile\nemail',
          }}
          enableReinitialize
          onSubmit={async (values) => {
            try {
              const body: Record<string, unknown> = {
                issuerUrl: values.issuerUrl.trim() || undefined,
                useDiscovery: values.useDiscovery,
                authorizationUrl: values.authorizationUrl.trim() || undefined,
                tokenUrl: values.tokenUrl.trim() || undefined,
                userInfoUrl: values.userInfoUrl.trim() || undefined,
                issuer: values.issuer.trim() || undefined,
                clientId: values.clientId.trim() || undefined,
                displayName: values.displayName.trim() || 'SSO',
                groupsClaim: values.groupsClaim.trim() || 'groups',
                nameClaim: values.nameClaim.trim() || 'name',
                emailClaim: values.emailClaim.trim() || 'email',
                groupMappings: values.groupMappings.filter(
                  (m) => (m.oidcGroup ?? '').trim() !== ''
                ),
                claimsToSync: (values.claimsToSync ?? '')
                  .split(/\n/)
                  .map((s) => s.trim())
                  .filter(Boolean),
                scopes: (values.scopes ?? '')
                  .split(/\n/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
              if (values.clientSecret) {
                body.clientSecret = values.clientSecret;
              }
              await axios.post('/api/v1/settings/oidc', body);
              mutate('/api/v1/settings/public');
              addToast(intl.formatMessage(messages.toastSettingsSuccess), {
                autoDismiss: true,
                appearance: 'success',
              });
            } catch (e) {
              addToast(intl.formatMessage(messages.toastSettingsFailure), {
                autoDismiss: true,
                appearance: 'error',
              });
            } finally {
              revalidate();
            }
          }}
        >
          {({ isSubmitting, values, setFieldValue }) => (
            <Form className="section">
              <div className="form-row">
                <div className="form-input-area flex items-center gap-2">
                  <Field
                    id="useDiscovery"
                    name="useDiscovery"
                    type="checkbox"
                    className="h-6 w-6 rounded-md"
                  />
                  <label htmlFor="useDiscovery" className="checkbox-label">
                    {intl.formatMessage(messages.useDiscovery)}
                    <span className="label-tip block font-normal">
                      {intl.formatMessage(messages.useDiscoveryTip)}
                    </span>
                  </label>
                </div>
              </div>
              {values.useDiscovery && (
                <div className="form-row">
                  <label htmlFor="issuerUrl" className="text-label">
                    {intl.formatMessage(messages.issuerUrl)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.issuerUrlTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      id="issuerUrl"
                      name="issuerUrl"
                      type="text"
                      inputMode="url"
                    />
                  </div>
                </div>
              )}
              {!values.useDiscovery && (
                <>
                  <div className="form-row">
                    <label htmlFor="authorizationUrl" className="text-label">
                      {intl.formatMessage(messages.authorizationUrl)}
                      <span className="label-tip">
                        {intl.formatMessage(messages.authorizationUrlTip)}
                      </span>
                    </label>
                    <div className="form-input-area">
                      <Field
                        id="authorizationUrl"
                        name="authorizationUrl"
                        type="text"
                        inputMode="url"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <label htmlFor="tokenUrl" className="text-label">
                      {intl.formatMessage(messages.tokenUrl)}
                      <span className="label-tip">
                        {intl.formatMessage(messages.tokenUrlTip)}
                      </span>
                    </label>
                    <div className="form-input-area">
                      <Field
                        id="tokenUrl"
                        name="tokenUrl"
                        type="text"
                        inputMode="url"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <label htmlFor="userInfoUrl" className="text-label">
                      {intl.formatMessage(messages.userInfoUrl)}
                      <span className="label-tip">
                        {intl.formatMessage(messages.userInfoUrlTip)}
                      </span>
                    </label>
                    <div className="form-input-area">
                      <Field
                        id="userInfoUrl"
                        name="userInfoUrl"
                        type="text"
                        inputMode="url"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <label htmlFor="issuer" className="text-label">
                      {intl.formatMessage(messages.issuer)}
                      <span className="label-tip">
                        {intl.formatMessage(messages.issuerTip)}
                      </span>
                    </label>
                    <div className="form-input-area">
                      <Field id="issuer" name="issuer" type="text" />
                    </div>
                  </div>
                </>
              )}
              <div className="form-row">
                <label htmlFor="clientId" className="text-label">
                  {intl.formatMessage(messages.clientId)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.clientIdTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field id="clientId" name="clientId" type="text" />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="clientSecret" className="text-label">
                  {intl.formatMessage(messages.clientSecret)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.clientSecretTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <SensitiveInput
                    as="field"
                    id="clientSecret"
                    name="clientSecret"
                    type="password"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="displayName" className="text-label">
                  {intl.formatMessage(messages.displayName)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.displayNameTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field id="displayName" name="displayName" type="text" />
                </div>
              </div>

              <div className="form-row">
                <span className="group-label">
                  {intl.formatMessage(messages.claimsSection)}
                </span>
              </div>
              <div className="form-row">
                <label htmlFor="groupsClaim" className="text-label">
                  {intl.formatMessage(messages.groupsClaim)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.groupsClaimTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field id="groupsClaim" name="groupsClaim" type="text" />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="nameClaim" className="text-label">
                  {intl.formatMessage(messages.nameClaim)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.nameClaimTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field id="nameClaim" name="nameClaim" type="text" />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="emailClaim" className="text-label">
                  {intl.formatMessage(messages.emailClaim)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.emailClaimTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field id="emailClaim" name="emailClaim" type="text" />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="claimsToSync" className="text-label">
                  {intl.formatMessage(messages.claimsToSync)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.claimsToSyncTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field
                    id="claimsToSync"
                    name="claimsToSync"
                    as="textarea"
                    rows={3}
                    placeholder={'department\nroles'}
                    className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="scopes" className="text-label">
                  {intl.formatMessage(messages.scopes)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.scopesTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field
                    id="scopes"
                    name="scopes"
                    as="textarea"
                    rows={2}
                    placeholder={'openid\nprofile\nemail'}
                    className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="form-row">
                <span className="group-label">
                  {intl.formatMessage(messages.groupMappingsSection)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.groupMappingsTip)}
                  </span>
                </span>
              </div>
              <div className="form-input-area max-w-4xl">
                {values.groupMappings.map((_, index) => (
                  <div
                    key={index}
                    className="mb-4 flex flex-wrap items-start gap-2"
                  >
                    <Field
                      name={`groupMappings.${index}.oidcGroup`}
                      type="text"
                      placeholder={intl.formatMessage(messages.oidcGroup)}
                      className="min-w-[120px] flex-1 rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                    />
                    <div className="min-w-[200px] flex-1">
                      <PermissionEdit
                        currentPermission={
                          values.groupMappings[index]?.permissions ?? 0
                        }
                        onUpdate={(newPermissions) =>
                          setFieldValue(
                            `groupMappings.${index}.permissions`,
                            newPermissions
                          )
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = values.groupMappings.filter(
                          (_, i) => i !== index
                        );
                        setFieldValue('groupMappings', next);
                      }}
                      className="rounded p-2 text-gray-400 hover:bg-gray-600 hover:text-white"
                      aria-label="Remove mapping"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  buttonType="default"
                  onClick={() =>
                    setFieldValue('groupMappings', [
                      ...values.groupMappings,
                      { oidcGroup: '', permissions: 0 },
                    ])
                  }
                >
                  {intl.formatMessage(messages.addMapping)}
                </Button>
              </div>

              <div className="form-row">
                <div className="form-input-area">
                  <Button type="submit" disabled={isSubmitting}>
                    {intl.formatMessage(globalMessages.save)}
                  </Button>
                </div>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </>
  );
};

export default SettingsOidc;
