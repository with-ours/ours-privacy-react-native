import React from 'react';
import {Text, TouchableOpacity, StyleSheet, View, ScrollView} from 'react-native';
import {OursPrivacyInstance} from '../Analytics';

export default class GroupScreen extends React.Component {

    constructor(props) {
        super(props);
        this.oursprivacy = OursPrivacyInstance;
        this.group = this.oursprivacy.getGroup("company_id", 12345);
    }

    setProperty = () => {
        this.group.set("prop_key", "prop_value");
    }

    setPropertyOnce = () => {
        this.group.setOnce("prop_key", "prop_value");
    }

    unsetProperty = () => {
        this.group.unset("aaa");
    }

    removeProperty = () => {
        this.group.remove("prop_key", "334");
    }

    unionProperty = () => {
        this.group.union("prop_key", ["prop_value_a", "prop_value_b"]);
    }

    deleteGroup = () => {
        this.oursprivacy.deleteGroup("company_id", 12345);
    }

    setGroup = () => {
        this.oursprivacy.setGroup("company_id", 12345);
    }

    addGroup = () => {
        this.oursprivacy.addGroup("company_id", 111);
    }

    removeGroup = () => {
        this.oursprivacy.removeGroup("company_id", 323);
    }

    trackWithGroups = () => {
        this.oursprivacy.trackWithGroups("tracked with groups", {"a": 1, "b": 2.3}, {"company_id": "OursPrivacy"});
    }

    flush = () => {
        this.oursprivacy.flush();
    }

    render() {
        return (
            <ScrollView>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.setProperty}>
                        <Text style={styles.buttonText}>Set One Property</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.setPropertyOnce}>
                        <Text style={styles.buttonText}>Set Properties Once</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.unsetProperty}>
                        <Text style={styles.buttonText}>Unset Property</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.removeProperty}>
                        <Text style={styles.buttonText}>Remove Property</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.unionProperty}>
                        <Text style={styles.buttonText}>Union Properties</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.deleteGroup}>
                        <Text style={styles.buttonText}>Delete Group</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.setGroup}>
                        <Text style={styles.buttonText}>Set Group</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.addGroup}>
                        <Text style={styles.buttonText}>Add Group</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.removeGroup}>
                        <Text style={styles.buttonText}>Remove Group</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.trackWithGroups}>
                        <Text style={styles.buttonText}>Track with Groups</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={styles.button} onPress={this.flush}>
                        <Text style={styles.buttonText}>Flush</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: '#1E90FF',
        width: '100%',
        alignItems: 'center',
        marginVertical: 10,
        paddingVertical: 10,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#ffffff',
        textAlign: "center"
    },
    touchableOpacity: {
        backgroundColor: '#1E90FF',
        borderRadius: 25,
        width: '100%',
        alignItems: 'center',
        marginVertical: 10,
        paddingVertical: 10,
    }
})
