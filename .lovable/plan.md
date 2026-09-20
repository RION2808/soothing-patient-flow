# Hospital Resource Control System

## Goal
Build a usable hospital operations website based on the supplied references, with a calm blue clinical interface and one continuous workflow from intake through discharge and long-term records.

## Main experience
- Replace the blank page with a responsive dashboard and compact navigation for Live Floor, Intake, Bed Board, Records, and Analytics.
- Add a patient intake workflow with name, age, gender, monitor connection status, automatic vital import, and manual-entry fallback.
- Show a heartbeat-style waiting state while monitor data is loading.
- Calculate an explainable five-stage acuity result from blood pressure, oxygen saturation, heart rate, respiration, age, pain, and consciousness.
- Present the result in the supplied format: unique patient ID and barcode, stage/category color, score explanation, refined vital cards, assigned doctor/nurse/intern, one assigned room, and the “Before transfer” checklist.

## Live hospital operations
- Add GREEN, YELLOW, and RED sections, each with an active-care list and queue arranged vertically.
- Add a clean bed board grouped by GREEN, YELLOW, and RED, clearly marking occupied and vacant beds.
- Add the workforce side panel with ELE, ME, and HE tiers, availability, free-flow status, and assigned crew.
- Add utilization charts, live activity updates, equipment status, and ambulance tracking including number plates.
- Add a single records-management section covering patients, staff, beds, equipment, and ambulances.
- Keep only queued or in-treatment patients on the live floor; discharged patients remain available in the main records.

## Capacity intelligence
- Calculate and display the Erlang-B gridlock probability in one compact line.
- Trigger an emergency modal at a concerning probability, advising staff to contact nearby hospitals or arrange extra capacity.
- Add a clear predictive shortage panel using current utilization trends and suggested preparation actions.

## Data and behavior
- Enable Lovable Cloud for persistent patient, staff, bed, equipment, ambulance, and activity records.
- Include realistic starter data so every dashboard area is immediately understandable.
- Make intake, automatic/manual vital entry, triage, assignment, queue movement, treatment, and discharge work end to end.

## Separate PyCharm package
- Provide a downloadable Flask-based Python edition with separate HTML/CSS/JavaScript and Python source files.
- Include a local SQLite schema, seeded demo records, the same triage and Erlang-B calculations, and a README with exact PyCharm setup and run instructions.

## Quality checks
- Verify the main workflow and emergency alert in the browser.
- Check desktop and mobile layouts for clipping, overlap, and readable controls.
- Inspect every page and downloadable file before delivery.
