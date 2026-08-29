# Public Site Integrity Sweep

## Rule
A visible public link should not imply content or functionality that does not exist.

## Fixed in this sweep
- Consolidated Topics and Blog into Resources.
- Rebuilt Resources around working content instead of Coming Soon cards.
- Fixed Nutrition image filename mismatch.
- Removed missing Nutrition image reference.
- Removed dead Nutrition article links.
- Removed dead Movement subtopic/article links.
- Removed dead Sleep subtopic/article links.
- Removed dead Wellbeing subtopic/article links.
- Removed dead Preventive Health subtopic/article links.
- Legacy `topics.html` and `blog.html` now route into Resources rather than maintaining competing content hubs.
- Topic pages use Resources in primary navigation.

## Repository hygiene findings
The repository contains legacy, experimental, and placeholder files that should not automatically be treated as public features. For example, `api/helloTools.js` is a one-byte placeholder. These are not deleted by this public-site sweep because they may belong to product development rather than the public website.

## Going forward
Before adding a public card, button, image, or article link:
1. Confirm the destination/asset exists.
2. Do not publish placeholder cards as if they are usable features.
3. Put education, activities, assessments, and tools under Resources unless a distinct top-level destination is justified.
4. Preserve old public URLs with redirects when consolidating navigation.
