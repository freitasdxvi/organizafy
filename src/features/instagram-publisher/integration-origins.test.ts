import { describe, expect, it } from 'vitest';
import { AVANCA_SITE_ORIGIN, PERSISTE_SITE_ORIGIN, connectionSiteOrigin, integrationOrigins } from '../../../supabase/functions/_shared/integration-origins';
describe('integration origin policy', () => {
  it('allows the production domain and Vercel alias as exact HTTPS origins', () => {
    const origins = integrationOrigins();
    expect([...origins]).toEqual([AVANCA_SITE_ORIGIN, PERSISTE_SITE_ORIGIN]);
    expect(origins.has('http://persiste.online')).toBe(false);
    expect(origins.has('https://persiste.online.attacker.example')).toBe(false);
    expect(origins.has('https://avanca.online.attacker.example')).toBe(false);
    expect(origins.has('https://avanca.online/path')).toBe(false);
    expect(origins.has('null')).toBe(false);
  });
  it('uses the deployment domain by default and supports explicit server configuration', () => {
    expect(connectionSiteOrigin()).toBe(AVANCA_SITE_ORIGIN);
    expect(connectionSiteOrigin('  ')).toBe(AVANCA_SITE_ORIGIN);
    expect(connectionSiteOrigin('https://avanca.online/')).toBe('https://avanca.online');
    expect(integrationOrigins('https://integration.example','https://callback.example').has('https://callback.example')).toBe(true);
  });
  it.each(['http://avanca.online','https://user:secret@avanca.online','https://avanca.online/path','https://avanca.online?redirect=other','https://avanca.online#fragment','https://*.example.com','https://example.com:8443'])('rejects unsafe server origin %s', value => {
    expect(()=>connectionSiteOrigin(value)).toThrow('invalid_integration_origin');
  });
});
