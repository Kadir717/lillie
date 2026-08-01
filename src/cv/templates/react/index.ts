import type { CvReactTemplate } from "./cv-react-template";
import { classicProfessionalReactTemplate } from "./classic-professional";
import { developerCardReactTemplate } from "./developer-card";
import { minimalReactTemplate } from "./minimal";

export const reactTemplates: Record<string, CvReactTemplate> = {
  classic_professional: classicProfessionalReactTemplate,
  developer_card: developerCardReactTemplate,
  minimal: minimalReactTemplate,
};

export const defaultReactTemplate = classicProfessionalReactTemplate;

export { classicProfessionalReactTemplate, developerCardReactTemplate, minimalReactTemplate };
export type { CvReactTemplate } from "./cv-react-template";
