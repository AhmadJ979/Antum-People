# Data Processing Agreement (DPA) — Bilingual Template

> **Template ID:** `antum-dpa-v1`
> **Version / الإصدار:** v1.0 (2026-09-17)
> **Author:** Compliance Expert (Agent) — 2026-09-09
> **Revision:** Brand updated to Antum People on 2026-09-17.
> **Use:** Controller (Employer) ↔ Processor (Vendor / Antum sub-processor)
> **Jurisdictions:** UAE PDPL (Federal Decree-Law No. 45/2021) & KSA PDPL (Royal Decree M/148)
> **Status:** Working template — obtain local counsel sign-off before use with live client data.
> **Schema mapping:** Populates `vendor_contracts` + `cross_border_transfers` tables (see `compliance-dpia-vendor-risk.md` §3).

This document is drafted bilingually (English primary, Arabic following). Clause headers are shown in English and Arabic so a single countersigned copy can serve either jurisdiction; toggle the **governing-law clause (§11)** and the **cross-border schedule (§9)** per entity.

---

## PART 1 — Data Processing Agreement (English)

### 1. Parties and Roles

1.1 **Controller** (`controller_ref`): [Employer Legal Name], [License/CR number], [Address]. The party that determines the purposes and means of processing Personal Data.

1.2 **Processor** (`vendor_id` / `processor_ref`): Antum (legal entity registration in progress [TO CONFIRM — formal entity name/suffix]), trade licence / CR number [TO CONFIRM — trade licence / CR number], registered address: Dubai, United Arab Emirates [TO CONFIRM — full registered address pending]; DPO: Ahmad Aljairoudi, dpo@antum.ae (reserved), phone [TO CONFIRM — DPO phone]. The party that processes Personal Data on behalf of the Controller.

1.3 This DPA forms part of the Master Services Agreement between the parties dated [date]. In the event of conflict, this DPA prevails on data-protection matters.

### 2. Definitions

Capitalised terms have the meanings in the applicable law: UAE PDPL (Federal Decree-Law No. 45/2021) and/or KSA PDPL (Royal Decree M/148), as selected in §11. "Personal Data", "Processing", "Data Subject", "Controller", "Processor", "Breach", and "Supervisory Authority" take their statutory meanings.

### 3. Subject-matter, Duration, Nature and Purpose

| Field | Detail | Schema |
|---|---|---|
| Subject-matter | HR onboarding/offboarding data processing | `vendor_contracts.contract_type='dpa'` |
| Duration | From [start_date] until services end + deletion window | `vendor_contracts.start_date/end_date` |
| Nature | Hosting, storage, processing of employment records | `vendors.vendor_type` |
| Purpose | Provision of [Antum People SaaS / payroll / insurance / background-check] services | `dpia_assessments.purpose` |

### 4. Categories of Data Subjects and Personal Data

4.1 **Data subjects** (`dpia_assessments.data_subject_categories`): employees, applicants, dependants, former employees.

4.2 **Personal data categories** (`dpia_assessments.data_categories`): identity, contact, employment, financial/salary, government IDs (Emirates ID / Iqama / passport), and — only where separately disclosed — health and biometric data (sensitive data).

### 5. Processor Obligations

The Processor shall:

5.1 **Act on documented instructions** only, and inform the Controller if an instruction infringes applicable law (UAE PDPL Art. 8; KSA PDPL Art. 7).

5.2 **Confidentiality** — ensure persons authorised to process are under confidentiality obligations.

5.3 **Security** — implement appropriate technical and organisational measures (UAE PDPL Art. 11): encryption at rest (AES-256) and in transit (TLS 1.2+), access control, pseudonymisation where feasible, and regular testing.

5.4 **Sub-processors** — not engage any sub-processor without the Controller's prior written authorisation, and flow down equivalent obligations. Record in `vendor_contracts.subprocessor_consent`.

5.5 **Assist the Controller** in fulfilling Data Subject requests (UAE PDPL Art. 14; KSA PDPL Art. 12) within the Controller's 30-day SLA, including export, rectification, restriction, and erasure/destruction.

5.6 **Breach notification** — notify the Controller without undue delay and in any event within **72 hours** of becoming aware (UAE PDPL Art. 16; KSA PDPL Art. 20), with sufficient detail for the Controller to meet its regulator notification obligations. Record in `breach_register`.

5.7 **Deletion/return** — on termination, delete or return all Personal Data and delete copies, unless storage is required by law. Provide written certification of deletion.

5.8 **Audit** — make available to the Controller (or its auditor) information necessary to demonstrate compliance, and permit/contribute to audits on reasonable notice.

### 6. Controller Obligations

The Controller warrants it has a lawful basis for processing (UAE PDPL Art. 4; KSA PDPL Art. 6) and has provided data subjects the required privacy notice. The Controller is responsible for responding to Data Subject requests, with the Processor assisting under §5.5.

### 7. International Data Transfers

See Schedule 1 (§9). The Processor shall not transfer Personal Data across borders except as set out in Schedule 1 and recorded in `cross_border_transfers`.

### 8. Liability and Indemnity

Each party is liable for its own breaches of applicable data protection law. Nothing limits liability that cannot be limited by law. The parties shall cooperate in good faith on any regulatory inquiry or claim.

### 9. Schedule 1 — Cross-Border Transfer Mechanism

Complete **one** mechanism per transfer (record each row in `cross_border_transfers`):

| Option | Condition | Legal reference |
|---|---|---|
| ☐ No transfer (data remains in-country) | Hosting in UAE/KSA | — |
| ☐ Adequacy decision | Destination country/territory recognised as adequate | UAE PDPL Art. 22; KSA PDPL Art. 29 |
| ☐ Standard Contractual Clauses (SCCs) | Destination not adequate; SCCs executed | UAE Cabinet Decision 65/2022; KSA SCCs |
| ☐ Derogation | Explicit consent / contract necessity | UAE PDPL Art. 23; KSA PDPL Art. 29 |

Destination country: [________]. Safeguard document reference: [________]. Transfer Impact Assessment completed: ☐ Yes ☐ No.

### 10. Term and Termination

This DPA remains in force for the duration of the services and thereafter until deletion/return under §5.7. Either party may terminate this DPA for a material breach that remains uncured 30 days after written notice.

### 11. Governing Law and Jurisdiction

☐ **UAE** — governed by the laws of the United Arab Emirates; disputes to [DIFC/ADGM/mainland] courts. *(select for UAE entities)*

☐ **KSA** — governed by the laws of the Kingdom of Saudi Arabia; disputes to [city] courts. *(select for KSA entities)*

11.1 **DIFC / ADGM carve-out.** Where the Controller is established in the Dubai International Financial Centre (DIFC) or the Abu Dhabi Global Market (ADGM), the applicable data protection law is **DIFC Law No. 5 of 2020** or the **ADGM Data Protection Regulations 2021** respectively, **not** the federal UAE PDPL. In such case, references to "UAE PDPL" in this DPA shall be read as references to the applicable free-zone law, and the competent authority is the DIFC Commissioner of Data Protection or the ADGM Office of Data Protection, as applicable. All processor obligations, cross-border safeguards, and breach-notification requirements in this DPA continue to apply.

### 12. Signatures

| Controller | Processor |
|---|---|
| Name: ______________ | Name: ______________ |
| Title: ______________ | Title: ______________ |
| Date: ______________ | Date: ______________ |

---

## PART 2 — اتفاقية معالجة البيانات (العربية)

### 1. الأطراف والأدوار

1.1 **جهة التحكم** (`controller_ref`): [الاسم القانوني لصاحب العمل]، [رقم الرخصة/السجل]، [العنوان]. الطرف الذي يحدد أغراض ووسائل معالجة البيانات الشخصية.

1.2 **المعالِج** (`vendor_id` / `processor_ref`): Antum (تسجيل الكيان القانوني قيد الإجراء [TO CONFIRM — الاسم الرسمي للكيان واللاحقة القانونية])، الرخصة التجارية / رقم السجل [TO CONFIRM — الرخصة التجارية / رقم السجل]، العنوان المسجل: دبي، الإمارات العربية المتحدة [TO CONFIRM — العنوان المسجل الكامل قيد الاستكمال]؛ مسؤول حماية البيانات: Ahmad Aljairoudi، dpo@antum.ae (محجوز)، الهاتف [TO CONFIRM — هاتف مسؤول حماية البيانات]. الطرف الذي يعالج البيانات الشخصية نيابةً عن جهة التحكم.

1.3 تشكل هذه الاتفاقية جزءاً من اتفاقية الخدمات الرئيسية المبرمة بين الطرفين بتاريخ [التاريخ]. وفي حال التعارض، تسود هذه الاتفاقية في المسائل المتعلقة بحماية البيانات.

### 2. التعريفات

تكون للمصطلحات الواردة بأحرف كبيرة المعاني الواردة في القانون المعمول به: قانون حماية البيانات الشخصية الإماراتي (المرسوم بقانون اتحادي رقم 45 لسنة 2021) و/أو نظام حماية البيانات الشخصية السعودي (المرسوم الملكي م/148)، حسب الاختيار في البند 11. وتأخذ مصطلحات "البيانات الشخصية" و"المعالجة" و"صاحب البيانات" و"جهة التحكم" و"المعالِج" و"الانتهاك" و"الجهة الإشرافية" معانيها القانونية.

### 3. الموضوع والمدة والطبيعة والغرض

| الحقل | التفصيل | المخطط |
|---|---|---|
| الموضوع | معالجة بيانات التوظيف (الالتحاق وإنهاء الخدمة) | `vendor_contracts.contract_type='dpa'` |
| المدة | من [تاريخ البدء] حتى انتهاء الخدمات + فترة الحذف | `vendor_contracts.start_date/end_date` |
| الطبيعة | استضافة وتخزين ومعالجة سجلات التوظيف | `vendors.vendor_type` |
| الغرض | تقديم خدمات [منصة Antum People / الرواتب / التأمين / التحقق من الخلفية] | `dpia_assessments.purpose` |

### 4. فئات أصحاب البيانات والبيانات الشخصية

4.1 **أصحاب البيانات** (`dpia_assessments.data_subject_categories`): الموظفون، المتقدمون، المُعالون، الموظفون السابقون.

4.2 **فئات البيانات الشخصية** (`dpia_assessments.data_categories`): بيانات الهوية، الاتصال، التوظيف، المالية/الراتب، المعرفات الحكومية (الهوية الإماراتية / الإقامة / جواز السفر)، و—فقط عند الإفصاح عنها بشكل منفصل—البيانات الصحية والبيومترية (بيانات حساسة).

### 5. التزامات المعالِج

يتعهد المعالِج بما يلي:

5.1 **التصرف بناءً على تعليمات موثقة فقط**، وإبلاغ جهة التحكم إذا كانت أي تعليمة تخالف القانون المعمول به (قانون الإمارات مادة 8؛ نظام السعودية مادة 7).

5.2 **السرية** — ضمان خضوع الأشخاص المصرح لهم بالمعالجة لالتزامات سرية.

5.3 **الأمن** — تنفيذ التدابير التقنية والتنظيمية المناسبة (قانون الإمارات مادة 11): التشفير أثناء التخزين (AES-256) وأثناء النقل (TLS 1.2+)، وضوابط الوصول، وإخفاء الهوية حيثما أمكن، والاختبار الدوري.

5.4 **المعالجون الفرعيون** — عدم إشراك أي معالج فرعي دون موافقة كتابية مسبقة من جهة التحكم، وإلزامهم بالتزامات مكافئة. يُسجل في `vendor_contracts.subprocessor_consent`.

5.5 **مساعدة جهة التحكم** في تلبية طلبات أصحاب البيانات (قانون الإمارات مادة 14؛ نظام السعودية مادة 12) ضمن مهلة 30 يوماً، بما في ذلك التصدير والتصحيح والتقييد والمحو/الإتلاف.

5.6 **الإخطار بالانتهاك** — إخطار جهة التحكم دون تأخير غير مبرر وبحد أقصى **72 ساعة** من العلم (قانون الإمارات مادة 16؛ نظام السعودية مادة 20)، بتفاصيل كافية لتمكين جهة التحكم من الوفاء بالتزامات الإخطار للجهة التنظيمية. يُسجل في `breach_register`.

5.7 **الحذف/الإعادة** — عند الإنهاء، حذف أو إعادة جميع البيانات الشخصية وحذف النسخ، ما لم يكن الاحتفاظ بها مطلوباً بموجب القانون. وتقديم شهادة خطية بالحذف.

5.8 **التدقيق** — إتاحة المعلومات اللازمة لإثبات الامتثال لجهة التحكم (أو مدققها)، والسماح بالتدقيق أو المساهمة فيه بإشعار معقول.

### 6. التزامات جهة التحكم

تضمن جهة التحكم وجود أساس قانوني للمعالجة (قانون الإمارات مادة 4؛ نظام السعودية مادة 6) وتقديم إشعار الخصوصية المطلوب لأصحاب البيانات. وتكون جهة التحكم مسؤولة عن الرد على طلبات أصحاب البيانات، مع مساعدة المعالِج بموجب البند 5.5.

### 7. نقل البيانات عبر الحدود

راجع الجدول 1 (البند 9). لا يجوز للمعالِج نقل البيانات الشخصية عبر الحدود إلا وفقاً للجدول 1 والمسجل في `cross_border_transfers`.

### 8. المسؤولية والتعويض

يكون كل طرف مسؤولاً عن انتهاكاته لقانون حماية البيانات المعمول به. ولا يحد أي شيء من المسؤولية التي لا يجوز تحديدها قانوناً. ويتعاون الطرفان بحسن نية في أي تحقيق تنظيمي أو مطالبة.

### 9. الجدول 1 — آلية النقل عبر الحدود

أكمل **آلية واحدة** لكل عملية نقل (تُسجل كل صف في `cross_border_transfers`):

| الخيار | الشرط | المرجع القانوني |
|---|---|---|
| ☐ لا نقل (تبقى البيانات داخل الدولة) | الاستضافة داخل الإمارات/السعودية | — |
| ☐ قرار كفاية | الوجهة معترف بها كمستوى حماية كافٍ | قانون الإمارات مادة 22؛ نظام السعودية مادة 29 |
| ☐ الشروط التعاقدية النموذجية (SCCs) | الوجهة غير كافية؛ تُنفذ الشروط النموذجية | قرار مجلس الوزراء الإماراتي 65/2022؛ الشروط السعودية |
| ☐ استثناء | موافقة صريحة / ضرورة تعاقدية | قانون الإمارات مادة 23؛ نظام السعودية مادة 29 |

بلد الوجهة: [________]. مرجع وثيقة الضمانات: [________]. تم إجراء تقييم أثر النقل: ☐ نعم ☐ لا.

### 10. المدة والإنهاء

تبقى هذه الاتفاقية سارية طوال مدة الخدمات وبعدها حتى الحذف/الإعادة بموجب البند 5.7. ويجوز لأي طرف إنهاء هذه الاتفاقية عند مخالفة جوهرية لم تُعالج خلال 30 يوماً من الإشعار الكتابي.

### 11. القانون الحاكم والاختصاص

☐ **الإمارات** — تخضع لقوانين دولة الإمارات العربية المتحدة؛ وتختص محاكم [دبي/أبوظبي]. *(اختر للجهات الإماراتية)*

☐ **السعودية** — تخضع لأنظمة المملكة العربية السعودية؛ وتختص محاكم [المدينة]. *(اختر للجهات السعودية)*

11.1 **استثناء المناطق الحرة (DIFC / ADGM).** إذا كانت جهة التحكم مؤسسة في مركز دبي المالي العالمي (DIFC) أو سوق أبوظبي العالمي (ADGM)، فإن قانون حماية البيانات المعمول به هو **قانون مركز دبي المالي العالمي رقم 5 لسنة 2020** أو **نظام حماية البيانات لسوق أبوظبي العالمي 2021** على التوالي، **وليس** قانون حماية البيانات الاتحادي الإماراتي. وفي هذه الحالة، تُقرأ الإشارات إلى "قانون حماية البيانات الإماراتي" في هذه الاتفاقية على أنها إشارات إلى قانون المنطقة الحرة المعمول به، وتكون الجهة المختصة هي مفوض حماية البيانات في مركز دبي المالي العالمي أو مكتب حماية البيانات في سوق أبوظبي العالمي، حسب الحالة. وتظل جميع التزامات المعالِج وضمانات النقل عبر الحدود ومتطلبات الإخطار بالانتهاك الواردة في هذه الاتفاقية سارية.

### 12. التوقيعات

| جهة التحكم | المعالِج |
|---|---|
| الاسم: ______________ | الاسم: ______________ |
| المنصب: ______________ | المنصب: ______________ |
| التاريخ: ______________ | التاريخ: ______________ |

---

## Schema Field Mapping (for Antum People ingestion)

| DPA clause | Table | Column(s) |
|---|---|---|
| §1 Parties | `vendors` / `vendor_contracts` | `name`, `entity_id`, `vendor_id` |
| §3 Subject-matter/purpose | `dpia_assessments` | `purpose`, `lawful_basis`, `data_categories` |
| §4 Data subjects/categories | `dpia_assessments` | `data_subject_categories`, `data_categories` |
| §5.4 Sub-processors | `vendor_contracts` | `subprocessor_consent` |
| §5.6 Breach 72h | `vendor_contracts` / `breach_register` | `breach_notification_hours`, `notified_*` |
| §7/§9 Transfers | `cross_border_transfers` | `source_country`, `destination_country`, `transfer_mechanism`, `legal_basis_ref`, `safeguard_document_ref` |
| §11 Governing law | `vendor_contracts` | `governing_law`, `jurisdiction` |

> **Checklist before use:** (1) fill Controller/Processor legal names + license numbers; (2) select governing-law clause (§11) per entity; (3) complete Schedule 1 for every cross-border flow; (4) obtain DPO review for KSA entities (mandatory under KSA PDPL Art. 11); (5) store countersigned copy reference in `vendor_contracts.dpa_ref`.
