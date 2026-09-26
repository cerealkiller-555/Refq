// ============================================================
// رِفق — صوت رِفق (كل نصوص الواجهة في مكان واحد)
// قواعد الصوت: هادئ، مشجع، بلا لوم، بلا أرقام على القلب،
// بلا "أنتِ متأخرة"، بلا streaks. الراحة جزء من الخطة.
// ============================================================

export const voice = {
  today: {
    hint: 'خطوة واحدة تكفي للبداية — ومش لازم تكوني مثالية.',
    energy: {
      title: 'طاقة اليوم',
      question: 'كيف طاقتك الآن؟',
      low: '🔴 منخفضة',
      medium: '🟡 متوسطة',
      high: '🟢 عالية',
      lightDay: 'أريد يومًا خفيفًا',
      notePlaceholder: 'ملاحظة (اختياري)…',
      saved: 'سجلنا طاقة اليوم 🤍 تعدليها في أي وقت.',
      needLevelFirst: 'اختاري مستوى الطاقة أولًا، وبعدين فعّلي اليوم الخفيف.',
      summary: 'طاقتك الآن: {level}',
      edit: 'تعديل',
      hide: 'إخفاء'
    },
    priorities: {
      title: 'أهم أولويات اليوم',
      empty: 'لا أولويات الآن — أضيفي مهمة صغيرة أو خذي نفسًا 🤍'
    },
    suggestion: {
      title: '✨ ماذا أفعل الآن؟',
      question: 'كم عندك من الوقت؟',
      minutes: 'دقيقة',
      start: 'ابدئي',
      again: 'اقتراح آخر',
      inProgressBadge: 'جارية'
    },
    period: {
      between: 'أنتِ الآن بين {current} و{next}',
      after: 'أنتِ الآن بعد {current}',
      before: 'الآن قبل {next} (ليل)',
      nightOpen: 'الآن ليل — وقت مفتوح 🌙',
      remaining: '{next} بعد {duration} 🤍',
      afterNext: 'بعد {next}',
      finalGuard: 'مواقيت اليوم من خدمة مواقيت الصلاة — تُحدَّث تلقائيًا، والصلوات لا تُقدَّم ولا تُحرَّك أبدًا.'
    },
    quickCapture: {
      title: 'التقاط سريع',
      placeholder: 'خاطرة أو مهمة… اكتبيها واضغطي Enter'
    },
    tasks: {
      title: 'مهام اليوم',
      empty: 'لا مهام لليوم ده — يوم خفيف 🤍',
      seeAll: 'وفيه {count} مهمة تانية في التخطيط ←'
    }
  },
  planning: {
    title: '📅 التخطيط',
    tasksTitle: 'المهام',
    addTitle: 'مهمة جديدة',
    quickAddPlaceholder: 'مهمة جديدة… اكتبيها واضغطي Enter',
    showDetails: '＋ تفاصيل — أهمية، موعد، طاقة',
    hideDetails: 'إخفاء التفاصيل',
    glance: {
      open: '{n} مهمة مفتوحة',
      weekTasks: '{n} مهمة هذا الأسبوع',
      weekEvents: '{n} حدث هذا الأسبوع',
      overdue: '{n} متأخرة — نرتّبها بلطف'
    },
    fields: {
      title: 'اسم المهمة',
      importance: 'الأهمية',
      urgency: 'الإلحاح',
      duration: 'المدة المتوقعة (دقائق)',
      deadline: 'الموعد النهائي (اختياري)',
      energy: 'الطاقة المطلوبة (اختياري)',
      save: 'إضافة المهمة'
    },
    importanceLabels: { high: 'مهمة', low: 'عادية' } as Record<string, string>,
    urgencyLabels: { high: 'عاجلة', low: 'غير عاجلة' } as Record<string, string>,
    energyLabels: { low: 'خفيفة', medium: 'متوسطة', high: 'عميقة' } as Record<string, string>,
    empty: 'لا مهام بعد — أضيفي أول مهمة بهدوء.',
    doneTitle: 'أُنجزت',
    calendar: {
      tabs: { day: '📅 اليوم', week: '🗓️ الأسبوع', month: '🗓️ الشهر' },
      addEventTitle: 'حدث جديد',
      eventName: 'اسم الحدث',
      kind: 'النوع',
      kindFixed: 'ثابت — لا يتحرك أبدًا',
      kindFlexible: 'مرن — وقت مخصص لمهمة',
      date: 'التاريخ',
      time: 'وقت البداية',
      duration: 'المدة (دقائق)',
      note: 'ملاحظة (اختياري)',
      save: 'إضافة الحدث',
      kindLabels: { fixed: 'ثابت', flexible: 'مرن' } as Record<string, string>,
      allDayLabel: 'طوال اليوم',
      googleLabel: 'Google',
      emptyDay: 'لا أحداث في هذا اليوم — يوم مفتوح لك 🤍',
      emptyWeek: 'أسبوعك فاضي — أضيفي أول حدث بهدوء.',
      emptyMonth: 'الشهر لسه فاضي — ابدئي بحدث واحد بهدوء.',
      tasksWord: 'مهام',
      eventsWord: 'أحداث',
      openDayHint: 'اضغطي أي يوم لعرض تفاصيله.',
      monthNames: [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ] as string[],
      daysShort: ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'] as string[],

      prev: 'السابق',
      next: 'التالي',
      today: 'اليوم',
      dayNames: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'] as string[],
      schedule: {
        button: 'جدولة 📅',
        title: 'جدولة المهمة في التقويم',
        date: 'اليوم',
        time: 'الساعة',
        confirm: 'حدّدها',
        cancel: 'بدون جدولة',
        done: 'المهمة اتحطت في التقويم 📅 تقدري تغيريها في أي وقت.'
      },
      recovery: {
        banner: 'فيه مهام كانت مجدولة في أيام فاتت. نعيد توزيعها على الأيام الجاية بلطف؟',
        button: 'أعد التوزيع بلطف',
        applied: 'تمت إعادة التوزيع 🤍 مفيش ضغط، والثوابت ما اتحركتش أبدًا.',
        dismiss: 'شكرًا، دلوقتي كفاية'
      },
      scheduledChip: 'مجدولة'
    }
  },
  heart: {
    title: '🤍 القلب',
    tabs: { athar: 'أثر', search_heart: 'فتش عن قلبك', waqfa: 'وقفة', muhasaba: 'محاسبة', sharia: 'نصوص شرعية' },
    athar: {
      title: 'أثر — ماذا بعد ما أنهيتِ خطوة؟',
      hint: 'خصّيصة صغيرة بعد إنجاز خطوة تعليمية — بلا ضغط.',
      prompt: 'كيف شعرتِ بعد ما أنهيتِ الخطوة؟',
      benefit: 'هل خرجتِ بفائدة أو فكرة؟',
      save: 'سجّلي الأثر',
      done: 'سجّلي أثرك 🤍',
      skip: 'مش دلوقتي',
      afterItem: 'بعد إنهاء: {item}'
    },
    search_heart: {
      title: 'فتش عن قلبك',
      hint: 'سؤال دوري هادئ — مجرد تأمل، بلا تقييم.',
      prompt: 'ماذا تحتاجين الآن؟',
      options: ['راحة', 'تركيز', 'دفء', 'وضوح', 'شيء آخر'],
      save: 'سجّلي',
      saved: 'سجّلي ما تحتاجينه 🤍',
      skip: 'تخطي'
    },
    waqfa: {
      title: 'وقفة — لحظة تأمل أسبوعية',
      hint: 'خصيصة أسبوعية — تُطرح مرة واحدة في الأسبوع.',
      prompt: 'كيف كان أسبوعك؟',
      wins: 'أبرز نجاح أو لحظة جميلة؟',
      challenge: 'ما أصعب شيء واجهتِه؟',
      nextWeek: 'ما أولويتك للأسبوع الجاي؟',
      save: 'سجّلي الوقفة',
      saved: 'سجّلي وقفتك الأسبوعية 🤍',
      skip: 'مش دلوقتي'
    },
    muhasaba: {
      title: 'محاسبة — تأمل اختياري',
      hint: 'محاسبة ذاتية هادئة — بدون أحكام.',
      prompt: 'ماذا فعلتِ اليوم لترضين عن نفسك؟',
      improvement: 'ما الذي تتمنين تحسينه بهدوء؟',
      save: 'سجّلي المحاسبة',
      saved: 'سجّلي محاسبتك 🤍',
      skip: 'مش دلوقتي'
    },
    sharia: {
      title: 'نصوص شرعية',
      hint: 'نص شرعي يلمس قلبك — آية أو حديث أو فائدة، والمصدر دائمًا مذكور.',
      addText: 'أضيفي نص',
      kind: 'النوع',
      text: 'النص',
      source: 'المصدر',
      linkPathLabel: 'مرتبط بمسار',
      noPath: 'بدون ربط',
      kinds: {
        ayah: 'آية',
        hadith: 'حديث',
        scholar_quote: 'قول عالم',
        faida: 'فائدة',
        tarif: 'تعريف'
      } as Record<string, string>,
      save: 'حفظ',
      cancel: 'إلغاء',
      empty: 'لا نصوص بعد — أضيفي آية أو حديث أو فائدة 🤍',
      linkedPath: 'مرتبط بمسار: {path}'
    },
    tabIcons: { athar: '🌱', search_heart: '💭', waqfa: '🧭', muhasaba: '🤍', sharia: '📖' } as Record<string, string>,
    historyFilterAll: 'الكل',
    showMore: 'شوفي كمان',

    history: 'السجل',
    noHistory: 'لا سجل بعد — سجّلي أول تأمل 🤍',
    todayDone: 'سجّلي اليوم — تقدري تعودي غدًا 🤍'
  },
  learning: {
    // مفاتيح الإدارة فقط — موروثة إلى «خطتي»، وبقيتها حُذف مع شاشة «رحلتي»
    addPathTitle: 'مسار جديد',
    pathName: 'اسم المسار (مثل: مادة المحاسبة)',
    pathType: 'نوع المسار',
    types: {
      university: '🎓 جامعة',
      course: '📚 كورس',
      religious_science: '🕌 علم شرعي',
      book: '📖 كتاب',
      quran: '📖 قرآن'
    } as Record<string, string>,
    addPath: 'أضيفي المسار',
    addItemPlaceholder: 'عنصر جديد… (مثل: محاضرة 3)',
    addItem: 'إضافة',
    pause: 'إيقاف مؤقت',
    activate: 'متابعة'
  },
  myPlan: {
    navLabel: 'خطتي',
    tabs: { plan: '📚 خطتي', tasks: '📋 المهام' },
    title: '📚 خطتي الدراسية',
    subtitle: 'موادكِ الدراسية بخطوات واضحة وجلسات هادئة — ركزي على خطوة واحدة تكفي للتقدم.',
    empty: 'لا توجد مواد دراسية بعد — أضيفي مادتكِ أو مساركِ الأول بزر «＋ مسار جديد» تحت هنا 🤍',
    progress: 'أُنجز {done} من {total} ({percent}%)',
    whereIStopped: 'آخر توقف:',
    noPreviousSession: 'بداية الرحلة — لم تسجلي جلسات بعد',
    nextAction: 'خطوتك التالية:',
    startSession: 'ابدئي جلسة',
    continueSession: 'مستمرة الآن',
    inProgressIndicator: 'شغّالة عليها الآن ⏳',
    allDone: 'أتممتِ كل خطوات هذه المادة بارك الله فيكِ 🌸',
    sessionsTotal: '{count} جلسات مسجلة',
    durationChip: '{minutes} د',
    expandItems: 'عرض كل الخطوات',
    collapseItems: 'طي الخطوات',
    activeTag: 'نشط',
    pausedTag: 'موقوف مؤقتًا',
    completedTag: 'مكتمل'
  },

  activeTask: {
    hide: 'إخفاء — المهمة مستمرة',
    restore: 'المهمة الجارية',
    replaceQuestion: 'إنتِ شغّالة على «{current}» — تبدئي «{next}»؟',
    replace: 'استبدال',
    back: 'رجوع',
    paused: 'موقوفة مؤقتًا',
    pause: 'إيقاف مؤقت',
    resume: 'استئناف',
    timeUp: 'خلص الوقت 🤍',
    logSession: '⏱ سجّلي جلسة',
    keepGoing: 'كملّي بلا وقت'
  },
  common: {
    complete: 'إنجاز',
    reopen: 'إعادة فتح',
    delete: 'حذف',
    edit: 'تعديل',
    cancel: 'إلغاء'
  },
  system: {
    title: '⚙️ النظام',
    navLabel: 'الإعدادات',
    appName: 'رِفق',
    tagline: 'رفق بنفسك — خطوة واحدة في الوقت',
    backupHint: 'بياناتك كلها محفوظة في متصفحك — وتقدري تخرجيها في ملف في أي وقت 🤍',
    exportTitle: 'نسخة احتياطية',
    exportHint: 'ملف JSON واحد فيه كل حاجة — مهام، مسارات، تأملات.',
    exportButton: '📥 نزّلي نسخة احتياطية',
    exportDone: 'تم تنزيل الملف 🤍 خزّنيه في مكان آمن.',
    importTitle: 'استيراد نسخة',
    importHint: 'اختاري ملف نسخة احتياطية سبق تنزيله.',
    importButton: '📤 استيراد نسخة',
    importConfirmQuestion: 'الاستيراد هيمسح كل البيانات الحالية ويحل مكانها محتوى الملف. نكمّل؟',
    importConfirm: 'أيوه، استوردي',
    importCancel: 'رجوع',
    importDone: 'تم الاستيراد 🤍 ({tables} جدول)',
    importInvalid: 'الملف ده مقروءش كنسخة احتياطية صحيحة.',
    importUnsupported: 'نسخة الملف ({version}) غير مدعومة — حدّثي التطبيق الأول.',
    dangerTitle: 'حذف كل البيانات',
    dangerHint: 'مسح نهائي لكل حاجة — بلا رجعة. خزّني نسخة احتياطية الأول لو محتاجة.',
    dangerButton: '🗑 امسحي كل حاجة',
    dangerConfirmQuestion: 'متأكدة؟ ده هيمسح كل مهامك ومساراتك وتأملاتك نهائيًا.',
    dangerConfirm: 'أيوه، امسحي',
    dangerCancel: 'لا، خلاص',
    dangerDone: 'اتمسحت كل البيانات. صفحة بيضاء جديدة 🤍',
    infoTitle: 'معلومات',
    schemaVersion: 'إصدار قاعدة البيانات: {version}',
    errorGeneric: 'حصلت مشكلة بسيطة — جرّبي تاني.',
    googleTitle: 'Google Calendar',
    googleHint:
      'اربطي تقويم جوجل بتشوفى أحداثك هنا مع أحداثك. القراءة فقط: التطبيق ما يرسل أي تعديل لتقويمك، والرمز يبقى في ذاكرة الصفحة إلى أن تقفليها.',
    googleConnect: '🔗 ربط وتقويم جوجل',
    googleConnecting: 'جارٍ الربط في صفحة ثانية…',
    googleSync: '🔄 مزامنة الآن',
    googleSyncing: 'جارٍ المزامنة…',
    googleDisconnect: 'فك الربط',
    googleConnected: 'متصل بـ Google Calendar 🤍',
    googleLastSync: 'آخر مزامنة: {time}',
    googleNeverSynced: 'لم تتم مزامنة بعد — اضغطي «مزامنة الآن».',
    googleEventsCount: '{count} حدث من جوجل معروض في التقويم',
    googleNoEvents: 'ما فيه أحداث في تقويم جوجل ضمن النطاق (90 يومًا قدام).',
    googleNotConfigured:
      'السجل ما مضبوط بعد: ضيفي VITE_GOOGLE_CLIENT_ID في ملف .env.local ثم أعد تشغيل التطبيق.',
    googleSyncDone: 'تمت المزامنة 🤍 {count} حدث من جوجل.',
    counts: {
      tasks: 'مهام',
      calendarEvents: 'أحداث',
      paths: 'مسارات',
      pathItems: 'خطوات',
      sessions: 'جلسات',
      reflections: 'تأملات',
      energyCheckins: 'قياسات طاقة',
      shariaTexts: 'نصوص شرعية',
      prayerAnchors: 'مراسي صلاة',
      settings: 'إعدادات'
    } as Record<string, string>
  }
};

/** تحية حسب الوقت — هادئة وبلا ضغط */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'صباح الخير 🌤';
  if (hour >= 12 && hour < 17) return 'نهارك هادئ 🌿';
  if (hour >= 17 && hour < 21) return 'مساء الخير 🌆';
  return 'ليلة طيبة 🌙';
}