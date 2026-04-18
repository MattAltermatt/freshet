
# Present-JSON — Example Input

Fill in the sections below. Ignore any section that doesn't apply. Reply "done" in the chat when finished.

---

## 1. Example URL

The kind of URL whose response we'd want to transform. Include both a QA and prod example if they matter.

```
qa:   https://qa-example.server.com/internal/user/1234?r=40&z=22
prod: https://example.server.com/internal/user/1234?r=40&z=22
```
These are fake, but fit the example.  'qa-example.server.com' and 'example.server.com' should be able to trigger different templates, same with "/internal/user", if that is seen, then it can trigger a template.  Probably have to do some regex or some sort of hiearachy. 
---

## 2. Example JSON response

Paste (or fabricate) one representative JSON body. 20–80 lines is plenty. Redact/rename anything sensitive.

```json
{
  "id": 1234,
  "insertDate": "2026-04-17T23:09:30+0000",
  "status": "DOWN",
  "internalId1": 7777,
  "internalId2": 8888,
  ... a lot of lines later ...
  "theValueICareAbout": 9999
}
```

---

## 3. What I want to SEE when this comes in

Plain English is fine. Bullets, sketches, paragraph — whatever's easiest.

An HTML page presented instead of the JSON.  At the top is a link, or something, that makes it very obvious where the original is.  'show raw'.  Then the HTML is whatever the user has configured in their templates for the JSON.  For me, I would do something like
top row:   id: 1234 (with a link to https://example.server.com/internal/user/1234?r=40&z=22 so that it can be copied easily) | Insert Date (insert date, but in my timezone (much easier for me to figure out the time!)) | status: DOWN (and this is in red, obviously marked.  there would be rules in the template that if the status was 'UP" then it would be green colored)
next row:  Config: and then an link to an internal page, like https://example.server.com/internal/product-name-etc/api/v1/9999
next row: maybe more status and links to internal or external servers based on IDs and conditionals.


- Front and center: has to render HTML, has to be able to parse values out of JSON
- Nice to have: ability to easily show the raw JSON
- Don't care about: panda bears.

---

## 4. Fields that become LINKS

Which fields are IDs / references that should become clickable links?
Format: `host` + `url` → `link template`.


Examples:

Imagine the user has this in the logic:
host     | url | link template
qa-a.b.c | /v1 | "[QA] A"
a.b.c.   | /v1 | "[PROD] A"
d.b.c.   | /f/b| "formatter for prod 'd'"

it would simply be `host` + `url` → `link template`, so `qa-a.b.c` + `/v1` → ""[QA] A"", which is a user named template that formats the json.


---

## 5. Fields with CONDITIONAL formatting

Which fields change how they render based on value? (e.g. true=green, false=red, enum→color)

Examples:
- `activity.currentStatus` → `true` green "Active" / `false` red "Inactive"
- `order.priority` → `high` red / `medium` yellow / `low` gray

---

## 6. Environment (QA vs prod) awareness

Does anything need to render differently in QA vs prod? (e.g. a big "QA" badge, different link host, hide some fields in prod)
yes, good idea, that should be a thing that is in the config for when the user sets the hosts and urls they care about, they can flag 'qa'.  Or is it better to flag 'prod'?  Or allow the user to pass in params?

---

## 7. Anything else

Open field for anything you want me to know that doesn't fit above.
