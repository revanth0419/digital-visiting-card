
export const generateVcf = (profile: {
    display_name?: string | null;
    username?: string | null;
    designation?: string | null;
    company?: string | null;
    public_phone?: string | null;
    public_email?: string | null;
    website?: string | null;
    location?: string | null; // Added location support
    bio?: string | null; // Added bio support
    avatar_url?: string | null; // Added avatar support (though vCard usage varies)
}) => {
    const name = profile.display_name || profile.username || "Digital Visiting Card";
    const org = profile.company || "";
    const title = profile.designation || "";
    const tel = profile.public_phone || "";
    const email = profile.public_email || "";
    const url = profile.website || "";
    const adr = profile.location || "";
    const note = profile.bio || "";

    // Sanitize and format the name for the filename
    const filename = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // Construct vCard 3.0 content
    // Note: vCard 3.0 is widely supported. 4.0 is newer but less compatible with older devices/apps.
    let vcard = `BEGIN:VCARD
VERSION:3.0
FN:${name}
N:${name};;;;
`;

    if (org) vcard += `ORG:${org}\n`;
    if (title) vcard += `TITLE:${title}\n`;
    if (tel) vcard += `TEL;TYPE=WORK,VOICE:${tel}\n`;
    if (email) vcard += `EMAIL;TYPE=WORK,INTERNET:${email}\n`;
    if (url) vcard += `URL:${url}\n`;
    if (adr) vcard += `ADR;TYPE=WORK:;;${adr};;;;\n`;
    if (note) vcard += `NOTE:${note}\n`;

    // Add the profile URL as a secondary URL or specific field if needed,
    // but standard URL field usually takes the website.
    // We can add a specialized X-SOCIAL-PROFILE or similar if needed,
    // but keeping it simple for maximum compatibility is best.

    vcard += `END:VCARD`;

    return { vcard, filename };
};

export const downloadVcf = (profile: any) => {
    const { vcard, filename } = generateVcf(profile);
    const blob = new Blob([vcard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
