import type { CvTemplate } from "../cv-template";
import { classicProfessionalTemplate } from "./classic-professional";
import { developerCardTemplate } from "./developer-card";

export const templates: Record<string, CvTemplate> = {
    classic_professional: classicProfessionalTemplate,
    developer_card: developerCardTemplate,
};

export const defaultTemplate = classicProfessionalTemplate;

