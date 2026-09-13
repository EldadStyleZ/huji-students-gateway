# Provisional contact map

Source: the one-page union staff PDF for תשפ״ז supplied on 13 September 2026. It contains 16 role mailboxes. The user requested general logic for now and will supply detailed duties later. Accordingly, the addresses below are transcribed facts; responsibility assignments and the office fallback are provisional inferences. Campus coverage is provisionally union-wide.

| Student issue                                                 | Proposed union mailbox     | Reason / limit                                                                                    |
| ------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| Course registration, exams, grades, study support             | `r_academy@aguda.org.il`   | Head of academics and reserve service; route university administrative steps separately           |
| Reserve-service accommodations                                | `r_academy@aguda.org.il`   | Reserve service is explicit in the role title                                                     |
| Tuition support, scholarships, accessibility, campus services | `r_revaha@aguda.org.il`    | Welfare/community is the closest general owner; precise scope needs refinement                    |
| Dormitories and housing                                       | `sr_revaha@aguda.org.il`   | Dormitories are explicit in the coordinator's title; private rental disputes may need redirection |
| Events and tickets                                            | `hevra@aguda.org.il`       | Social department is a provisional owner                                                          |
| Communities, clubs and initiatives                            | `communities@aguda.org.il` | Community coordinator is the closest title                                                        |
| Unclear / other requests                                      | `mazkirut@aguda.org.il`    | Office is a provisional general-help fallback; confirm monitoring before live sending             |

Other addresses are retained in `config/roles-source.json` rather than being offered as destinations for unrelated student problems. In particular, the union's bookkeeping mailbox is not assumed to handle university tuition debt. A communications role is not automatically the owner of every event-related request. The representation coordinator and first-year mentoring program can get their own precise subtopics once their scope is defined.

The source marks the social-media role as being recruited. The user confirmed its mailbox, `creative@aguda.org.il`, is currently monitored; this is recorded separately from the vacancy marker.

`config/directory.json` is the one place to change active routing. `approved`, `approvedBy` and `validUntil` distinguish a draft map from an operational receiving arrangement. The app rejects expired or equally ranked destinations instead of choosing an arbitrary recipient.
