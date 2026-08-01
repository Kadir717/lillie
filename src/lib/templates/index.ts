import type { CvTemplate } from "../cv-template";
import { classicProfessionalTemplate } from "./classic-professional";
import { developerCardTemplate } from "./developer-card";
import { minimalTemplate } from "./minimal";

export const templates: Record<string, CvTemplate> = {
  classic_professional: classicProfessionalTemplate,
  developer_card: developerCardTemplate,
  minimal: minimalTemplate,
};

export const defaultTemplate = classicProfessionalTemplate;

export { classicProfessionalTemplate, developerCardTemplate, minimalTemplate };
