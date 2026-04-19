import { describe, it, expect } from 'vitest';
import { render } from './engine';

describe('render — values and variables', () => {
  it('returns non-template text unchanged', () => {
    expect(render('<p>hello</p>', {}, {})).toBe('<p>hello</p>');
  });
  it('interpolates a dotted-path value', () => {
    expect(render('<p>{{ id }}</p>', { id: 42 }, {})).toBe('<p>42</p>');
  });
  it('interpolates a variable from vars namespace', () => {
    expect(render('<p>{{ vars.env }}</p>', {}, { env: 'qa' })).toBe('<p>qa</p>');
  });
  it('escapes HTML in values by default', () => {
    expect(render('<p>{{ x }}</p>', { x: '<b>&' }, {})).toBe('<p>&lt;b&gt;&amp;</p>');
  });
  it('renders missing values as empty string', () => {
    expect(render('<p>[{{ missing }}]</p>', {}, {})).toBe('<p>[]</p>');
  });
  it('raw filter skips HTML escaping', () => {
    expect(render('<p>{{ x | raw }}</p>', { x: '<b>' }, {})).toBe('<p><b></p>');
  });
});

describe('render — {% if %}', () => {
  it('renders the body when condition is true (string equality)', () => {
    const t = '{% if status == "UP" %}<green>{% endif %}';
    expect(render(t, { status: 'UP' }, {})).toBe('<green>');
  });
  it('renders nothing when condition is false', () => {
    const t = '{% if status == "UP" %}<green>{% endif %}';
    expect(render(t, { status: 'DOWN' }, {})).toBe('');
  });
  it('renders else branch when unequal', () => {
    const t = '{% if status == "UP" %}<green>{% else %}<red>{% endif %}';
    expect(render(t, { status: 'DOWN' }, {})).toBe('<red>');
  });
  it('supports vars.X as the left-hand side', () => {
    const t = '{% if vars.env == "qa" %}[QA]{% endif %}';
    expect(render(t, {}, { env: 'qa' })).toBe('[QA]');
    expect(render(t, {}, { env: 'prod' })).toBe('');
  });
  it('truthy check for booleans (archived: true)', () => {
    expect(render('{% if archived %}A{% endif %}', { archived: true }, {})).toBe('A');
    expect(render('{% if archived %}A{% endif %}', { archived: false }, {})).toBe('');
  });
  it('blank check for empty strings (license.name != blank)', () => {
    expect(render('{% if x != blank %}Y{% endif %}', { x: 'here' }, {})).toBe('Y');
    expect(render('{% if x != blank %}Y{% endif %}', { x: '' }, {})).toBe('');
  });
});

describe('render — {% for %}', () => {
  it('iterates primitive array elements using the loop variable', () => {
    const t = '{% for x in items %}<li>{{ x }}</li>{% endfor %}';
    expect(render(t, { items: ['a', 'b', 'c'] }, {})).toBe('<li>a</li><li>b</li><li>c</li>');
  });
  it('scopes dotted paths to the current element', () => {
    const t = '{% for u in users %}{{ u.name }};{% endfor %}';
    expect(render(t, { users: [{ name: 'Alice' }, { name: 'Bob' }] }, {})).toBe('Alice;Bob;');
  });
  it('renders empty for empty array', () => {
    expect(render('{% for x in items %}x{% endfor %}', { items: [] }, {})).toBe('');
  });
  it('renders empty when missing', () => {
    expect(render('{% for x in items %}x{% endfor %}', {}, {})).toBe('');
  });
});

describe('render — filters', () => {
  it('formats an ISO timestamp with custom format', () => {
    process.env.TZ = 'UTC';
    const t = '{{ insertDate | date: "yyyy-MM-dd" }}';
    expect(render(t, { insertDate: '2026-04-17T23:09:30Z' }, {})).toBe('2026-04-17');
  });
  it('interpolates vars and json into a link URL', () => {
    const t = '{{ "https://{{vars.adminHost}}/user/{{id}}" | link }}';
    expect(render(t, { id: 9 }, { adminHost: 'a.com' })).toBe('https://a.com/user/9');
  });
  it('percent-encodes query components in a link', () => {
    const t = '{{ "https://x/?q={{q}}" | link }}';
    expect(render(t, { q: 'a&b' }, {})).toBe('https://x/?q=a%26b');
  });
  it('compacts large numbers via num filter', () => {
    expect(render('{{ stars | num }}', { stars: 234567 }, {})).toBe('235k');
  });
  it('compacts numeric strings via num filter', () => {
    expect(render('{{ count | num }}', { count: '1500' }, {})).toBe('1.5k');
  });
});

describe('render — array-root JSON', () => {
  it('exposes the array as `items` so it has a stable identifier-safe handle', () => {
    const t = '{% for c in items %}{{ c.name }};{% endfor %}';
    expect(render(t, [{ name: 'A' }, { name: 'B' }], {})).toBe('A;B;');
  });
  it('supports indexed access via items[N]', () => {
    const t = '{{ items[0].name }}';
    expect(render(t, [{ name: 'first' }, { name: 'second' }], {})).toBe('first');
  });
  it('supports {% assign %} from items[0] for top-level array roots', () => {
    const t = '{% assign c = items[0] %}{{ c.name.common }}';
    expect(render(t, [{ name: { common: 'Japan' } }], {})).toBe('Japan');
  });
  it('exposes items.size and the empty branch fires on empty arrays', () => {
    const t = '{% if items.size == 0 %}empty{% else %}{{ items.size }}{% endif %}';
    expect(render(t, [], {})).toBe('empty');
    expect(render(t, [1, 2, 3], {})).toBe('3');
  });
});

describe('render — sanitizer pass', () => {
  it('strips a <script> tag from the final output', () => {
    expect(render('<p>hi</p><script>alert(1)</script>', {}, {})).toBe('<p>hi</p>');
  });
});
