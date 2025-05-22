require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = "OursPrivacyReactNative"
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = package['license']
  s.author = { 'OursPrivacy, Inc' => 'support@oursprivacy.com' }
  s.homepage = package['homepage']
  s.platform = :ios, "11.0"
  s.swift_version = '5.0'
  s.source = { :git => "https://github.com/oursprivacy/oursprivacy-react-native.git", :tag => s.version }
  s.source_files = "ios/**/*.{swift,h,m}"
  s.requires_arc = true
  s.preserve_paths = 'LICENSE', 'README.md', 'package.json', 'index.js'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }

  s.dependency "React-Core"
  s.dependency "React-Core/DevSupport"
  s.dependency "React-RCTBridge"
  s.dependency "ReactCommon"
  s.dependency "Yoga"
  s.dependency "React-Codegen"
  s.dependency "RCT-Folly"
end
