-- Leo starter data. Prices other than the Toss Sports e-commerce build are
-- placeholders — edit them in Leo → Services.

insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.services (name, description, sac, unit, price, sort) values
  ('E-commerce website',           'Online store with product catalogue, cart, checkout and admin panel',  '998314', 'project', 30000, 10),
  ('Business website',             'Up to 8 pages, mobile-first, SEO-ready, contact form',                 '998314', 'project', 20000, 20),
  ('Landing page',                 'Single high-conversion page for a campaign or launch',                 '998314', 'project',  8000, 30),
  ('Mobile app (Android + iOS)',   'Cross-platform app built around your workflow',                        '998314', 'project', 60000, 40),
  ('SEO · AEO · GEO',              'Search, answer-engine and AI-visibility optimisation',                 '',       'month',    8000, 50),
  ('Data analytics dashboard',     'Business dashboard connected to your data sources',                    '998314', 'project', 25000, 60),
  ('TableServe QR ordering setup', 'QR menu and table ordering for restaurants',                           '998314', 'project', 15000, 70),
  ('Website maintenance',          'Updates, backups, uptime monitoring and small changes',                '',       'month',    2000, 80),
  ('Domain + hosting',             'Domain registration and hosting for one year',                         '',       'year',     4000, 90);

with c as (
  insert into public.clients (name, company, city, state, notes)
  values ('Toss Sports', 'Toss Sports', 'Chennai', 'Tamil Nadu',
          'Handmade tennis-ball cricket bats. D2C store with product configurator and WhatsApp ordering.')
  returning id
)
insert into public.projects (client_id, title, type, status, value, notes)
select id, 'E-commerce website', 'E-commerce', 'delivered', 30000,
       'Product configurator, WhatsApp ordering, gamified rewards loop.'
from c;
