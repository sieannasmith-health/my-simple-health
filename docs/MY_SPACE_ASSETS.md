# My Space asset handoff

The My Space implementation expects these production image-set names in `ios/MySimpleHealthApp/App/Assets.xcassets`:

| Space | Asset catalog name | Source file |
| --- | --- | --- |
| Warm House | `MySpaceWarmHouse` | `warm-house.png` |
| Garden House | `MySpaceGardenHouse` | `garden-house.png` |
| Library House | `MySpaceLibraryHouse` | `library-house.png` |
| Coastal Retreat | `MySpaceCoastalRetreat` | `coastal-retreat.png` |
| Meditation Retreat | `MySpaceMeditationRetreat` | `meditation-retreat.png` |
| Quiet Minimal | `MySpaceQuietMinimal` | `quiet-minimal.png` |
| Executive Study | `MySpaceExecutiveStudy` | `executive-study.png` |
| Sunset House | `MySpaceSunsetHouse` | `sunset-house.png` |
| City at Night | `MySpaceCityAtNight` | `city-at-night.png` |
| Morning High-Rise | `MySpaceMorningHighRise` | `morning-high-rise.png` |

`Plain` intentionally has no image asset. `executive-study-alt.png` is preserved as an alternate and is not used by the current implementation. `my-health-editorial-mockup.png` is reference-only and must not ship as a live screen.

The My Health implementation gracefully falls back to the standard MSH canvas when a named image is unavailable, so image import can be completed independently of the SwiftUI work.
